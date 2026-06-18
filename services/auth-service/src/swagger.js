module.exports = {
  swaggerOptions: {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'FoodFlow Auth Service API',
        version: '1.0.0',
        description: 'Authentication and authorization service',
      },
      servers: [{ url: 'http://localhost:3001' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    apis: ['./src/routes/*.js'],
  },
};
