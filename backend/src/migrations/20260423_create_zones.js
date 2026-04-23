module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Zones', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      nivel_educativo: { type: Sequelize.STRING, allowNull: false },
      director_area_id: { type: Sequelize.INTEGER, allowNull: false },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Zones');
  },
};
