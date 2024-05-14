const db = require('../db')
const express = require('express')
const router = express()
const fs = require('fs');

require('dotenv').config()



// libreria session y su configuración
const session = require('express-session')
router.use(session({
  secret: process.env.SESSION_COOKIE,
  resave: false,
  saveUninitialized: false
}));

router.use((req, res, next) => { 
  //Si el usuario está logeado en la sesión, pasa los datos del usuario en local
  if (req.session && req.session.user) {
    res.locals.user = req.session.user;
  }
  next();
});

router.get('/', (req, res) => {
    res.render('courses')
});

router.get('/new', (req, res) => {
  fs.readFile('./public/data/classes.json', 'utf8', (err, data) => {
    const jsonData = JSON.parse(data);
    res.render('courses/new', { jsonData: jsonData });
  });
});

router.get('/subscriptions', (req, res) => {
    res.render('courses/subscriptions')
});

router.post('/new', (req, res) => {
  let { title,description,category, class_select,select_price_radio } = req.body

  let tags
  try{ tags = JSON.parse(req.body.input_tags_values) } 
  catch (error) { tags = [0] }
  tags = JSON.stringify(tags)

  let price=0
  if (select_price_radio === "pay"){ price=req.body.price }

  let official=0
  if (req.session.user.id == 1) { official = 1 }

  let consulta_insert="INSERT INTO courses (title, description, class, category, tags, rating, owner_id, price, official, discount, total_purchases) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"

  db.query(
    consulta_insert,
    [title,description,class_select, category, tags, 0 , req.session.user.id, price, official, 0, 0 ],
    (error, results) => {
      if (error) {
        console.error("Error al insertar el curso:", error);
      } else {
        console.log("Curso insertado con éxito:", results);
      }
    }
  );

  res.redirect('/courses/new')
});
  

module.exports = router
