module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('baja_movimientos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      id_producto: { type: Sequelize.INTEGER, allowNull: false },
      cantidad: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      motivo: { type: Sequelize.TEXT, allowNull: true },
      foto_path: { type: Sequelize.STRING, allowNull: true },
      id_usuario: { type: Sequelize.INTEGER, allowNull: false },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('baja_movimientos');
  },
};
