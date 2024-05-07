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

  
module.exports = router
