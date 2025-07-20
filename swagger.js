const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Usuarios',
      version: '1.0.0'
    }
  },
  apis: ['./routes/*']
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
