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
    const jsonData = JSON.parse(data)
    res.render('courses/new', { jsonData: jsonData })
  });
});

router.get('/watch/:id', (req, res) => {
  let course_id = req.params.id
  let user_id = req.session.user.id

  if (user_id===undefined){ res.redirect('/login') }

  let consulta_select= "SELECT * FROM courses WHERE id = ?"


  db.query(consulta_select, [course_id], (error, results_course) => {

    if (results_course.length === 0) { //Si no existe el curso

      return res.status(404).send('Curso no encontrado')//CAMBIAR A NOT FOUND

    } else{ //Si existe el curso
      let course = results_course[0]
      let course_tags= JSON.parse(course.tags) //Convertir las tags en un array

      let consulta_check = "SELECT * FROM user_course WHERE course_id = ? AND user_id = ?"
      db.query(consulta_check, [course_id,user_id], (error, results) => {

        //Sacar precio con descuento si lo tiene
        let price_discount=0
        if(Math.trunc(course.discount)!==0){ 
          price_discount = course.price - ((course.price * course.discount ) / 100)
        }

        //Variable para ver si le pertenece el curso
        let is_owned=false
        if ( results_course[0].owner_id==user_id ){ is_owned=true}

        //Variable para ver si lo has comprado
        let is_bought=false
        if ( results.length !==0){ is_bought=true}

        //Variable con rating que le ha dado si lo ha comprado y le ha hecho una review
        let p_rating=0
        if(is_bought && results[0].personal_rating!==0){ p_rating = results[0].personal_rating}

        let consulta_get = "SELECT * FROM user_course WHERE course_id = ?"
        db.query(consulta_get, [course_id],(error, results_reviews)=>{

          let reviews = results_reviews
          console.log(reviews.length)
          res.render('courses/watch',{course, reviews, course_tags, is_owned, is_bought, p_rating, price_discount})
        
        })
      })
    }
  })
})

router.get('/subscriptions', (req, res) => {
  res.render('courses/subscriptions')
})

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
