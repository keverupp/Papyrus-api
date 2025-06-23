// config/migrations/20250623000001_api_keys.js

exports.up = function (knex, Promise) {
  return knex.schema.createTable("api_keys", function (table) {
    table.increments("id");
    table.string("key_hash", 255).notNullable().unique().index();
    table.string("name", 255).notNullable(); // Nome identificador da key
    table.string("type", 50).notNullable().defaultTo("basic"); // basic, premium, unlimited
    table.integer("requests_per_minute").notNullable().defaultTo(10);
    table.boolean("is_active").defaultTo(true).index();
    table.text("description").nullable(); // Descrição do uso da key
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.timestamp("last_used_at").nullable();
  });
};

exports.down = function (knex, Promise) {
  return knex.schema.dropTable("api_keys");
};
