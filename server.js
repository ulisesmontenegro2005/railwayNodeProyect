import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { engine as exphbs } from 'express-handlebars';
import * as db from './src/db/mongodb/mongo.js';
import { matchPassword } from './src/db/mongodb/sessions.js';
import UserModel from './src/db/mongodb/sessions.js';
import { ProductsOptions } from './src/db/sqlite3/connection/connection.js';
import ProductsClienteSQL from './src/db/sqlite3/classes/ProductsClass.js';
import parseArgs from 'minimist';
import path from 'path';
import { fileURLToPath } from 'url';

import { Server }  from 'socket.io';
import { createServer } from 'http';

import cluster from 'cluster';
import os from 'os';

import compression from 'compression';

import * as dotenv from 'dotenv';
dotenv.config();

const config = {
    alias: {
        p: "PORT",
        m: "MODE"
    }, 
    default: {
        PORT: 8080,
        MODE: 'FORK'
    }
}

let {MODE} = parseArgs(process.argv.slice(2), config)

MODE = MODE.toUpperCase()

if (MODE == 'CLUSTER' && cluster.isMaster) {
    const numCPUs = os.cpus().length
    console.log('Número de CPUs: ', numCPUs)
    console.log(`Master ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', worker => {
        console.log(`worker ${worker.process.pid} died, ${new Date().toLocaleString()}`);
        cluster.fork();
    });

} else {
    console.log(`Worker ${process.pid} started`);

    const dbClass = new db.Mongo;
    db.connect();

    //----- DIRNAME -----//

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    //----- Express -----//

    const app = express();

    //----- SocketIO -----//

    const httpServer = new createServer(app);
    const io = new Server(httpServer, {});

    const products = []

    io.on('connection', socket => {
        console.log('New user connected');
    
            socket.emit('products', products);
            socket.on('update-products', data => {
                products.push(data);
    
                const sqlProducts = new ProductsClienteSQL(ProductsOptions);
    
                sqlProducts.crearTabla()
                .then(() => {
                    return sqlProducts.addProducts(products)
                })
                .catch((err) => {
                    console.log(err);
                })
                .finally(() => {
                    return sqlProducts.close()
                })
    
                io.sockets.emit('products', products);
            })
    
            dbClass.getMsg()
            .then(d => {
                socket.emit('messages', d)
            })
            .catch(err => {
                console.log(err);
            })
    
            socket.on('update-chat', async data => {
    
                dbClass.addMsgMongo(data)
    
                dbClass.getMsg()
                .then(data2 => {
                    io.sockets.emit('messages', data2)
                })
                .catch(err => {
                    console.log(err);
                })
            })
    })

    //----- App -----//

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static('src'));

    // ----- Session and Passport -----//

    app.use(session({
        secret: 'esteesmisecret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 3600000
        }
    }))
    
    app.use(passport.initialize())
    app.use(passport.session())

    passport.use('register', new LocalStrategy({ passReqToCallback: true }, async (req, username, password, done) => {
        const { email } = req.body;
    
        const user = await UserModel.findOne({ "username": username });
    
        if (user) {
            return done(null, false, 'That user has already register')
        }
    
        const newUser = await UserModel.create({username,password,email})
    
        done(null, newUser);
    }))
    
    passport.use('login', new LocalStrategy( async (username, password, done) => {
        let user = await UserModel.findOne({ "username": username })
    
        if (!user) {
            return done(null, false, 'This user not exist')
        }
    
        const isMatch = await matchPassword(password, user.password);
        if (!isMatch) return done(null, false, 'Incorrect password');
    
        done(null, user)
    }))
    
    passport.serializeUser((user, done) => {
        done(null, user.username)
    })
    
    passport.deserializeUser(async (username, done) => {
        const user = UserModel.findOne({ "username": username });
    
        done(null, user)
    })

    function requireAuthentication(req, res, next) {
        if (req.isAuthenticated()) {
            next()
        } else {
            res.redirect('/login')
        }
    }

    //----- HBS -----//

    app.engine('.hbs', exphbs({ extname: '.hbs', defaultLayout: 'main.hbs' }))
    app.set('views', path.join(__dirname, '/src/views'));
    app.set('view engine', '.hbs')

    //----- APP -----//

    app.get('/', (req, res) => {
        res.redirect('/datos')
    })

    app.get('/login', (req, res) => {
        if (req.user) {
            return res.redirect('/datos')
        }

        res.sendFile(__dirname + '/src/login.html')
    })

    app.post('/login', passport.authenticate('login', { failureRedirect: '/faillogin', successRedirect: '/datos' }))

    app.get('/faillogin', (req, res) => {
        res.render('login-error')
    })

    app.get('/register', (req, res) => {
        if (req.user) {
            return res.redirect('/datos')
        }

        res.sendFile(__dirname + '/src/register.html')
    })

    app.post('/register', passport.authenticate('register', { failureRedirect: '/failregister', successRedirect: '/'}))

    app.get('/failregister', (req, res) => {
        res.render('register-error')
    })

    app.get('/datos', requireAuthentication, (req, res) => {
        if (!req.session.contador) {
            req.session.contador = 0
        }

        req.session.contador++

        res.sendFile(__dirname + '/src/datos.html')
    })

    app.get('/logout', (req, res) => {
        req.session.destroy()

        res.redirect('/')
    })

    app.get('/get-data', async (req, res) => {
        if (!req.session.passport.user) {
            return res.redirect('/')
        }

        const user = await UserModel.findOne({'username': req.session.passport.user}, {__v: 0, _id: 0, password: 0});

        res.send({user, contador: req.session.contador})
    })

    app.get('/info', compression(), (req, res) => {
        res.send({
            argsEntrada: process.argv,
            sistema: process.platform,
            node: process.versions.node,
            memoriaReservada: process.memoryUsage().rss,
            pathExec: process.execPath,
            pid: process.pid,
            carpetaProyecto: process.argv[1].split('/')[6]
        })
    })

    //----- Listening -----//
    
    const PORT =  process.env.PORT;

    httpServer.listen(PORT, () => {
        console.log(MODE);
        console.log(`Listening in port ${PORT}`);
    })
}































