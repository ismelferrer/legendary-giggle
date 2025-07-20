const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const userRoutes = require('./routes/userRoutes');
const mainRoutes = require('./routes/mainRoutes');
const { swaggerUi, specs } = require('./swagger');


const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;


app.use('/', mainRoutes);

app.use('/api', userRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor en puerto ${PORT}`);
  });
});




