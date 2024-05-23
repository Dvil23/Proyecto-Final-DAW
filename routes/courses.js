const db = require('../db')
const express = require('express')
const router = express()
const fs = require('fs');

require('dotenv').config()



// libreria session y su configuración
const session = require('express-session');
const { parse } = require('path');
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

router.get('/watch/:id', async (req, res) => {
  let course_id = req.params.id;
  let user_id = req.session.user.id;

  if (user_id === undefined) {
    res.redirect('/login');
    return;
  }


  let consulta_select = "SELECT * FROM courses WHERE id = ?";
  let results_course = await realizarConsulta(consulta_select, [course_id]);

  if (results_course.length === 0) { //Si no existe el curso
    res.redirect('/404');
    return;
  }
  
  let course = results_course[0];
  let course_tags = JSON.parse(course.tags); //Convertir las tags en un array

  let consulta_check = "SELECT * FROM user_course WHERE course_id = ? AND user_id = ?";
  let results_user_course = await realizarConsulta(consulta_check, [course_id, user_id]);

  //Sacar precio con descuento si lo tiene
  let price_discount = 0;
  if (Math.trunc(course.discount) !== 0) {
    price_discount = course.price - ((course.price * course.discount) / 100);
  }

  //Ver si le pertenece el curso
  let is_owned=false
  if ( course.owner_id==user_id ){ is_owned=true}

  //Ver si lo has comprado
  let is_bought=false
  if ( results_user_course.length !== 0){ is_bought=true}
  console.log(is_bought)

  //Rating que le ha dado si lo ha comprado y le ha hecho una review
  let p_rating = 0;
  if (is_bought && results_user_course[0].personal_rating !== 0) {
    p_rating = results_user_course[0].personal_rating;
  }

   //Review que le ha dado si lo ha comprado y le ha hecho una review
  let p_description = "";
  if (is_bought && results_user_course[0].review !== "") {
    p_description = results_user_course[0].review;
  }

  //Conseguir TODAS las compras/reviews del curso
  let consulta_get_reviews = "SELECT * FROM user_course WHERE course_id = ?";
  let results_reviews = await realizarConsulta(consulta_get_reviews, [course_id]);

  //Metemos en un array todas las compras con una review, con su nombre, estrellas y comentario
  let all_comments = [];
  for (const unique_rev of results_reviews) {
    if (unique_rev.review != "") {

      let consulta_user = "SELECT * FROM users WHERE id = ?"

      console.log("SELECT * FROM users WHERE id =", unique_rev.user_id)
      let user_done_review = await realizarConsulta(consulta_user, [unique_rev.user_id])

      all_comments.push({
        username: user_done_review[0].username,
        comment: unique_rev.review,
        stars: unique_rev.personal_rating
      });
    }
  }

  let reviews = results_reviews;

  res.render('courses/watch', { course,reviews,course_tags,is_owned,is_bought,p_rating,price_discount,course_id,p_description,all_comments});
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
  
router.post('/comment_review/:id', async (req, res) => {
  let review_description = req.body.review_description
  let stars = parseInt(req.body.stars)
  let id = req.params.id;

  // Consulta para obtener todas las compras del curso
  let consulta_find_purchases = "SELECT * FROM user_course WHERE course_id = ?";
  let results_all_purchases = await realizarConsulta(consulta_find_purchases, [id]);

  // Conseguimos todas las reviews que no sean el default 0, y todas las estrellas menos la que ya habia puesto el usuario
  let total_reviews = 0
  let total_stars = 0
  results_all_purchases.forEach(review => {

    if (review.personal_rating !== 0) {
      total_reviews += 1;
      if (review.user_id!=req.session.user.id){
        total_stars += review.personal_rating
      }
    }
  });
  //Sumamos la nueva valoración
  total_stars += stars
  valoracion_final = total_stars/total_reviews

  //Consulta para actualizar la valoración del curso
  let consulta_update = "UPDATE courses SET rating = ? WHERE id = ?";
  await realizarConsulta(consulta_update, [valoracion_final, id]);

  //Consulta para actualizar la valoración y descripción personal de tu review en el curso
  let consulta_update_personal = "UPDATE user_course SET personal_rating = ?, review = ? WHERE user_id = ? AND course_id = ?";
  await realizarConsulta(consulta_update_personal, [stars,review_description,req.session.user.id,id]);

  res.redirect(`/courses/watch/${id}`);
  
});

//Funcion para hacer consultas y esperar
async function realizarConsulta(consulta, params) {
  return new Promise((resolve, reject) => {
    db.query(consulta, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}




module.exports = router
