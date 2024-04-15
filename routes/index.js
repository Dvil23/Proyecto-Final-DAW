var express = require('express');
var router = express.Router();
const db = require('../db')

/* GET home page. */
router.get('/', (req, res, next) => {
  // Ejemplo de consulta a la base de datos
  db.query('SELECT * FROM actor', (err, result) => {
    if (err) {
      console.error('Error al consultar la base de datos:', err);
      res.status(500).send('Error de servidor');
      return;
    }
    res.json(result);
  });
});

module.exports = router;

