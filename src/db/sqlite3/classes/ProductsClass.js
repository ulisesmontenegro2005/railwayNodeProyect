import knex from 'knex';

class ProductsClienteSQL {

    constructor(options) {
        this.knex = knex(options)
    }

    crearTabla() {
        return this.knex.schema.dropTableIfExists('products')
        .finally(() => {
            return this.knex.schema.createTable('products', table => {
                table.increments('id').primary()
                table.string("name", 50).notNullable()
                table.string("stock", 10).notNullable()
                table.string("thumbnail", 100).notNullable()
            })
        })
    }

    addProducts(products) {
        return this.knex('products').insert(products)
    }

    close() {
        this.knex.destroy()
    }

}

export default ProductsClienteSQL;