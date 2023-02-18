const socket = io();

async function getData() {
    const data = await fetch('/get-data');
    const d = await data.json();

    return { d };
}

// GET BY IDS

const spanName = document.getElementById('span-name');
const spanEmail = document.getElementById('span-email');
const spanContador = document.getElementById('span-contador');

async function inicio () {
    getData()
    .then(data => {
        spanName.innerHTML = data.d.user.username
        spanEmail.innerHTML = data.d.user.email
        spanContador.innerHTML = data.d.contador
    })
    .catch(err => {
        console.log(err);
    })
}

inicio()

// ACTIONS OF PRODUCTS

const formProducto = document.getElementById('form-producto');
formProducto.addEventListener('submit', e => {
    e.preventDefault();

    const product = {
        name: document.getElementById('producto-nombre').value,
        stock: document.getElementById('producto-stock').value,
        thumbnail: document.getElementById('producto-url').value
    }

    socket.emit('update-products', product)
    formProducto.reset();
})

socket.on('products', renderProducts);
async function renderProducts(products) {

    const fetchRender = await fetch('./views/products.hbs');
    const textoPlantilla = await fetchRender.text();
    const functionTemplate = Handlebars.compile(textoPlantilla);

    const html = functionTemplate({ products });
    document.getElementById('productos').innerHTML = html;
}

// ACTIONS OF CHAT APP

const formChat = document.getElementById('form-chat');
formChat.addEventListener('submit', e => {
    e.preventDefault();

    const hora = new Date();

    const message = {
        author: {
            id: document.getElementById('chat-mail').value,
            nombre: document.getElementById('chat-name').value,
            apellido: document.getElementById('chat-lastname').value,
            edad: document.getElementById('chat-age').value,
            alias: document.getElementById('chat-alias').value,
            icon: document.getElementById('chat-icon').value
        },
        text: document.getElementById('chat-msg').value,
        hora: '[' + hora.toLocaleString() + ']'
    }

    socket.emit('update-chat', message);
    document.getElementById('chat-msg').value = '';
})

socket.on('messages', renderMessages)
async function renderMessages(messages) {

    const fetchRender = await fetch('./views/chat.hbs');
    const textoPlantilla = await fetchRender.text();
    const functionTemplate = Handlebars.compile(textoPlantilla);

    const html = functionTemplate({ messages });
    document.getElementById('chat').innerHTML = html;
}

async function logout() {
    getData()
    .then(data => {
        Swal.fire({
            icon: 'success',
            title: `Te desloguaste correctamente ${data.d.user.username}`,
            showConfirmButton: false,
            timer: 2000
        });
    })
    .catch(err => {
        console.log(err);
    })

    setInterval(() => {
        window.location.href = '/logout';
    }, 2000);
}
