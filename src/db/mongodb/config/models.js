import mongoose from 'mongoose';

const messagesCollection = 'messages';

const messagesSchema = new mongoose.Schema({
    author: {
        id: String,
        nombre: String,
        apellido: String,
        edad: Number,
        alias: String,
        icon: String
    },
    text: String,
    hora: String
})

export const messages = mongoose.model(messagesCollection, messagesSchema);


