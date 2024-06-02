const db = require('../db')
const express = require('express')
const router = express()
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const multer  = require('multer')
const upload = multer({ storage: multer.memoryStorage({ inMemory: true }) })


require('dotenv').config()
const { upload_to_server, delete_from_server, upload_image_to_server } = require('../sshUpload');


// libreria session y su configuración
const session = require('express-session');
const { parse } = require('path');
router.use(session({
  secret: process.env.SESSION_COOKIE,
  resave: false,
  saveUninitialized: false
}));

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

function isAuthenticated(req, res, next) {
  if (req.session.myuser && req.session.myuser.id) {
    next(); // Usuario autenticado, continuar con la siguiente función
  } else {
    res.redirect('/login'); // Redirigir a la página de login si no está autenticado
  }
}


router.use((req, res, next) => { 
  //Si el usuario está logeado en la sesión, pasa los datos del usuario en local
  if (req.session && req.session.myuser) {
    res.locals.myuser = req.session.myuser;
  }
  next();
});


//-----------GET COURSES-----------
router.get('/', async (req, res) => {

  let consulta_select = "SELECT * FROM courses";
  let courses = await realizarConsulta(consulta_select,[]);

  let consulta_select_users = "SELECT * FROM users WHERE id IN (SELECT owner_id FROM courses)";
  let users = await realizarConsulta(consulta_select_users,[]);

  fs.readFile('./public/data/classes.json', 'utf8', (err, data) => {
    const jsonData = JSON.parse(data)
    res.render('courses/courses_filter',{courses,users,jsonData})
  });
  
});

//-----------GET CREAR CURSO-----------
router.get('/new', isAuthenticated, (req, res) => {
  //JSON con todas las clases que puede ser un curso
  fs.readFile('./public/data/classes.json', 'utf8', (err, data) => {
    const jsonData = JSON.parse(data)
    res.render('courses/new', { jsonData: jsonData })
  });
});

//-----------GET MIRAR CURSO ESPECIFICO-----------
router.get('/watch/:id', isAuthenticated, async (req, res) => {
  let course_id = req.params.id;
  let user_id = req.session.myuser.id

  
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

  //Conseguir las secciones del curso
  let consulta_get_sections = "SELECT * FROM sections WHERE course_id = ? ORDER BY segment, component"
  let results_sections = await realizarConsulta(consulta_get_sections, [course_id]);

  //Conseguir cuantos segmentos distintos hay 
  let consulta_total_segments = "SELECT MAX(segment) AS total_segments FROM sections WHERE course_id = ?";
  let result_total_segments = await realizarConsulta(consulta_total_segments, [course_id]);
  result_total_segments=result_total_segments[0].total_segments+1

  //Conseguir TODAS las compras/reviews del curso
  let consulta_get_reviews = "SELECT * FROM user_course WHERE course_id = ? AND personal_rating != 0";
  let results_reviews = await realizarConsulta(consulta_get_reviews, [course_id]);

  //Metemos en un array todas las compras con una review, con su nombre, estrellas y comentario
  let all_comments = [];
  for (const unique_rev of results_reviews) {
    if (unique_rev.personal_rating !== 0) {

      let consulta_user = "SELECT * FROM users WHERE id = ?"

      let user_done_review = await realizarConsulta(consulta_user, [unique_rev.user_id])

      all_comments.push({
        username: user_done_review[0].username,
        specific_pfp: user_done_review[0].pfp,
        comment: unique_rev.review,
        stars: unique_rev.personal_rating
      });
    }
  }

  let reviews = results_reviews;

  //Conseguir TODAS las compras/reviews del curso
  let consulta_get_owner = "SELECT * FROM users WHERE id = ?";
  let owner_username = await realizarConsulta(consulta_get_owner, [course.owner_id]);
  owner_username = owner_username[0].username

  res.render('courses/watch', { course,reviews,course_tags,is_owned,is_bought,p_rating,price_discount,course_id,p_description,all_comments, results_sections, result_total_segments, owner_username});
})

//-----------GET MIRAR SECCION DE CURSO ESPECIFICO-----------
router.get('/watch/:course_id/:component_id', isAuthenticated, async (req, res) => {
  let course_id = req.params.course_id;
  let component_id = req.params.component_id;
  let user_id = req.session.myuser.id


  let consulta_find = "SELECT * FROM courses WHERE id = ?";
  let course=await realizarConsulta(consulta_find, [course_id])
  course = course[0]

  let is_owned = false

  //Si no es el dueño del curso, miramos si lo ha comprado
  if (course.owner_id !== user_id){ 

    let consulta_find_bought = "SELECT * FROM user_course WHERE course_id = ? AND user_id = ?";
    let user_course=await realizarConsulta(consulta_find_bought, [course_id,user_id])
    
    if (user_course.length === 0){
      res.redirect('/')
      return
    }
  }else{
    is_owned = true
  }

  //Conseguir la sección
  let consulta_find_section = "SELECT * FROM sections WHERE id = ?";
  let section=await realizarConsulta(consulta_find_section, [component_id])
  section = section[0]

  //No puedes entrar si no tiene video (a menos que seas el owner)
  if (!is_owned && section.video_name===null || !is_owned && section.video_name===""){
    res.redirect('/')
    return
  }

  //Conseguir las secciones del curso
  let consulta_get_sections = "SELECT * FROM sections WHERE course_id = ? ORDER BY segment, component"
  let results_sections = await realizarConsulta(consulta_get_sections, [course_id]);

  //Conseguir cuantos segmentos distintos hay 
  let consulta_total_segments = "SELECT MAX(segment) AS total_segments FROM sections WHERE course_id = ?";
  let result_total_segments = await realizarConsulta(consulta_total_segments, [course_id]);
  result_total_segments=result_total_segments[0].total_segments+1


  res.render('courses/section/watch_component',{course_id,course,is_owned,section,results_sections,result_total_segments, is_bought: true})
  

})
//-----------GET MOSTRAR SUBSCRIPCIONES-----------
// router.get('/subscriptions', (req, res) => {
//   res.render('courses/subscriptions')
// })

//-----------GET EDITAR CURSO-----------
router.get('/edit/:id', isAuthenticated, async (req, res) => {
  let course_id = req.params.id;
  let user_id = req.session.myuser.id

  let consulta_find = "SELECT * FROM courses WHERE id = ? AND owner_id = ?";
  let course=await realizarConsulta(consulta_find, [course_id,user_id])
  course= course[0]

  if (course){
    //JSON con todas las clases que puede ser un curso
    fs.readFile('./public/data/classes.json', 'utf8', (err, data) => {

      const jsonData = JSON.parse(data)
      let tags = JSON.parse(course.tags)
      res.render(`courses/edit`,{ jsonData: jsonData , course, tags})
    });
  }else{
    res.redirect('/')
    return
  }
  
})

//-----------GET EDITAR SECCIÓN DE CURSO-----------
router.get('/edit/:course_id/:component_id',  async (req, res) => {
  let course_id = req.params.course_id;
  let component_id = req.params.component_id;
  let user_id = req.session.myuser.id

  let consulta_find = "SELECT * FROM courses WHERE id = ?";
  let course=await realizarConsulta(consulta_find, [course_id])
  course= course[0]
  
  if (course.owner_id!==user_id){
    res.redirect('/')
    return
  }

  let consulta_find_section = "SELECT * FROM sections WHERE id = ?";
  let section=await realizarConsulta(consulta_find_section, [component_id])
  section= section[0]

  //Conseguir las secciones del curso
  let consulta_get_sections = "SELECT * FROM sections WHERE course_id = ? ORDER BY segment, component"
  let results_sections = await realizarConsulta(consulta_get_sections, [course_id]);

  //Conseguir cuantos segmentos distintos hay 
  let consulta_total_segments = "SELECT MAX(segment) AS total_segments FROM sections WHERE course_id = ?";
  let result_total_segments = await realizarConsulta(consulta_total_segments, [course_id]);
  result_total_segments=result_total_segments[0].total_segments+1

  let consulta_check = "SELECT * FROM user_course WHERE course_id = ? AND user_id = ?";
  let results_user_course = await realizarConsulta(consulta_check, [course_id, user_id]);

  //Ver si lo has comprado
  let is_bought=false
  if ( results_user_course.length !== 0){ is_bought=true}

  //Ver si le pertenece el curso
  let is_owned=false
  if ( course.owner_id==user_id ){ is_owned=true}

  


  res.render(`courses/section/edit_component`,{course,section,results_sections,result_total_segments,is_bought,is_owned,results_user_course,course_id})
})


//-----------GET AÑADIR SECCION-----------
router.get('/add_section/:id', isAuthenticated, async (req, res) => {
  let course_id = req.params.id;
  let user_id = req.session.myuser.id

  let consulta_find ="SELECT * FROM courses WHERE id = ?"
  let course = await realizarConsulta(consulta_find, [course_id]);

  res.render(`courses/add`,{course})
  
})

//-----------POST COMPRAR CURSO-----------
router.get('/buy/:id', async (req, res) => {
  let course_id = req.params.id;
  let user_id = req.session.myuser.id;

  let consulta_update = "UPDATE courses SET total_purchases = total_purchases +1 WHERE id = ?";
  await realizarConsulta(consulta_update, [course_id]);

  let consulta_insert = "INSERT INTO user_course VALUES(?,?,0,'')";
  await realizarConsulta(consulta_insert, [user_id,course_id]);

  res.redirect(`/courses/watch/${course_id}`);
})

//-----------POST EDITAR CURSO-----------
router.post('/edit/:id', async (req, res) => {
  let course_id = req.params.id;
  let { title,description,category, class_select,select_price_radio,select_discount } = req.body
  
  let tags
  try{ tags = JSON.parse(req.body.input_tags_values) } 
  catch (error) { tags = [0] }
  tags = JSON.stringify(tags)

  let price=0
  if (select_price_radio === "pay"){ price=req.body.price }

  let discount=0
  if (select_discount === "discount"){ discount=req.body.discount_input}

  let consulta_update="UPDATE courses SET title = ?, description = ?, class = ?, category = ?, tags = ?, price = ?, discount = ? WHERE id = ?"
  await realizarConsulta(consulta_update, [title,description,class_select,category,tags,price,discount,course_id]);

  res.redirect(`/courses/watch/${course_id}`)
});

//-----------POST CREAR CURSO-----------
router.post('/new', (req, res) => {
  let { title,description,category, class_select,select_price_radio } = req.body

  let tags
  try{ tags = JSON.parse(req.body.input_tags_values) } 
  catch (error) { tags = [0] }
  tags = JSON.stringify(tags)

  let price=0
  if (select_price_radio === "pay"){ price=req.body.price }

  let official=0
  if (req.session.myuser.id == 1) { official = 1 }

  let consulta_insert="INSERT INTO courses (title, description, class, category, tags, rating, owner_id, price, official, discount, total_purchases) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"

  db.query(
    consulta_insert,
    [title,description,class_select, category, tags, 0 , req.session.myuser.id, price, official, 0, 0 ],
    (error, results) => {
      if (error) {
        console.error("Error al insertar el curso:", error);
      } else {
        console.log("Curso insertado con éxito:", results);
      }
    }
  );

  res.redirect('/profile')
});

//-----------POST EDITAR COMPONENTE-----------
router.post('/edit/:course_id/:component_id', upload.single('file'), isAuthenticated, async (req, res) => {
  let course_id = req.params.course_id;
  let component_id = req.params.component_id
  let { title,description} = req.body
  let file = req.file

  let consulta_select="SELECT * FROM sections WHERE id = ?"
  let seccion = await realizarConsulta(consulta_select, [component_id]);
  seccion=seccion[0]


  if (file!== undefined){

    let folderName = req.session.myuser.id
    
    let file_name= `${uuidv4()}.mp4`
    await upload_to_server(folderName, req.file, file_name);

    let consulta_update_video="UPDATE sections SET video_name = ? WHERE id = ?"
    await realizarConsulta(consulta_update_video, [file_name,component_id]);
  }

  

  if (seccion.title !== title || seccion.description !== description){
    let consulta_update="UPDATE sections SET title = ?, description = ? WHERE id = ?"
    await realizarConsulta(consulta_update, [title,description,component_id]);
  }

  res.redirect(`/courses/watch/${course_id}/${component_id}`)
});


//-----------POST DEJAR REVIEW Y ESTRELLAS-----------
router.post('/comment_review/:id', async (req, res) => {
  const { list1, list2 } = req.body;
  console.log('List 1:', list1);
  console.log('List 2:', list2);

  let review_description = req.body.review_description
  let stars = parseInt(req.body.stars)
  let id = req.params.id;

  // Consulta para obtener todas las compras del curso
  let consulta_find_purchases = "SELECT * FROM user_course WHERE course_id = ?";
  let results_all_purchases = await realizarConsulta(consulta_find_purchases, [id]);

  // Conseguimos todas las reviews que no sean el default 0, y todas las estrellas menos la que ya habia puesto el usuario
  let total_reviews = 0
  let total_stars = 0
  already=false
  results_all_purchases.forEach(review => {

    if (review.personal_rating !== 0) {
      total_reviews += 1;
      total_stars += review.personal_rating
      if (review.user_id==req.session.myuser.id){
        already=review.personal_rating
      }
    }
  });
  
  if (already!=false){  
    //Si ya habia dado una valoración, tenemos que restar su antigua 
    total_stars-=already
  }else{
    //Si no la ha dado, tenemos que añadir una al total
    total_reviews+=1
  }

  //Sumamos la nueva valoración
  total_stars += stars
  valoracion_final = total_stars/total_reviews

  //Consulta para actualizar la valoración del curso
  let consulta_update = "UPDATE courses SET rating = ? WHERE id = ?";
  await realizarConsulta(consulta_update, [valoracion_final, id]);

  //Consulta para actualizar la valoración y descripción personal de tu review en el curso
  let consulta_update_personal = "UPDATE user_course SET personal_rating = ?, review = ? WHERE user_id = ? AND course_id = ?";
  await realizarConsulta(consulta_update_personal, [stars,review_description,req.session.myuser.id,id]);

  res.redirect(`/courses/watch/${id}`);
  
});



router.post('/change_order/:id', async (req, res) => {
  try{ sections = JSON.parse(req.body.section_order) } catch (error) { console.log(error); return res.redirect("/")}
  let course_id = req.params.id;

  let count_segment = 0;
  for (const key of Object.keys(sections)) {
    let count_component = 1
    
    for (const component of sections[key]) {

      //AÑADIR COMPONENTE SI ES NUEVO
      if (component.startsWith('new-')){ 
        console.log("NEW", component)
        let formatted_string = component.slice(4)
        let new_component = "INSERT INTO sections (course_id,title,segment,component) VALUES (?,?,?,?)";
        await realizarConsulta(new_component, [course_id,formatted_string,key,count_component]); 
      } 
      //BORRAR COMPONENTE SI LO HEMOS BORRADO
      else if (component.startsWith('del-')){
        console.log("DEL", component)
        let formatted_string = component.slice(4)

        let find_component = "SELECT * FROM sections  WHERE id = ?";
        let found_component= await realizarConsulta(find_component, [formatted_string]);
        let video_name= found_component[0].video_name

        if (video_name!==null && video_name!==""){ 

          //Borrar video de nuestro servidor
          let find_course = "SELECT * FROM courses WHERE id = ?";
          let found_course= await realizarConsulta(find_course, [course_id]);
          let owner_id = found_course[0].owner_id
          
          await delete_from_server(owner_id, video_name)
        }
        let remove_component = "DELETE FROM sections  WHERE id = ?";
        await realizarConsulta(remove_component, [formatted_string]);


      }
      //TODO LO DEMAS LE HACE UPDATE PARA CAMBIARLOS DE SITIO
      else{
        console.log("UPDATE", component)
        let update_component = "UPDATE sections SET segment = ?, component = ? WHERE id = ?";
        await realizarConsulta(update_component, [count_segment, count_component, component]);
      }
      count_component += 1;
    }
    count_segment +=1
  }

  res.redirect(`/courses/watch/${course_id}`)

  

})

router.post('/change_back_image/:id', upload.single('file'), async (req, res) => {

  let course_id = req.params.id
  const folderName = "backgrounds";
  const file_name = `${uuidv4()}.jpg`;

  try {
      console.log("Subiendo imagen...")
      await upload_image_to_server(folderName, req.file, file_name);
      console.log("Imagen subida")
      let consulta_update = "UPDATE courses SET background_image = ? WHERE id = ?";
      await realizarConsulta(consulta_update, [file_name, course_id]);
      res.redirect(`/courses/watch/${course_id}`);
  } catch (error) {
      console.error(error);
      res.status(500).send('Error subiendo la imagen');
  }

})


module.exports = router
