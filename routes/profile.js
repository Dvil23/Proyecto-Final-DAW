const db = require('../db')
const express = require('express')
const router = express()
const bcrypt = require('bcrypt')

require('dotenv').config()

const multer  = require('multer')
const upload = multer({ storage: multer.memoryStorage({ inMemory: true }) })

const saltRounds = 10
const {upload_image_to_server } = require('../sshUpload');
const { v4: uuidv4 } = require('uuid');

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

// libreria session y su configuración
const session = require('express-session')
router.use(session({
  secret: process.env.SESSION_COOKIE,
  resave: false,
  saveUninitialized: false
}));

router.use((req, res, next) => { 
  //Si el usuario está logeado en la sesión, pasa los datos del usuario en local
  if (req.session && req.session.myuser) {
    res.locals.myuser = req.session.myuser;
  }
  next();
});

router.get('/', async (req, res) => {
    if (req.session.myuser && req.session.myuser.id){
        res.redirect(`/profile/${req.session.myuser.id}`) 
    }else{
        res.redirect('/')
    }
   
});

//----------GET MOSTRAR PÁGINA DE EDITAR TUS DATOS---------------
router.get('/account', isAuthenticated, (req, res) => {
    
    let consulta_check="SELECT * FROM users WHERE id = ?"
    try{
        //Buscamos tu usuario con tu id de la session y mostramos la página con tus datos
        db.query(consulta_check,[req.session.myuser.id],(error,results)=>{
            results = results[0]
            res.render('profile/account',{username: results.username, phone: results.phone, type: results.type, message: "",biography: results.biography})
            
        })
    } catch {
        //Si no encuentra, es que no estás logeado
        res.redirect('/')
        return
    }
});

//----------GET MOSTRAR PÁGINA DE PERFIL DE USUARIO DE CUALQUIER USUARIO---------------
router.get('/:id', async (req, res) => {
    let user_id = req.params.id;
    let consulta_find = "SELECT * FROM users WHERE id = ?";
    let user = await realizarConsulta(consulta_find,[user_id]);
    user=user[0]

    let consulta_find_created_courses = "SELECT * FROM courses WHERE owner_id = ?";
    let courses_owned = await realizarConsulta(consulta_find_created_courses,[user_id]);

    let consulta_bought_courses = "SELECT * FROM user_course WHERE user_id = ?";
    let courses_bought = await realizarConsulta(consulta_bought_courses,[user_id]);

    let consulta_select_users = "SELECT * FROM users";
    let users = await realizarConsulta(consulta_select_users,[]);

    let all_courses=[]
    for (const course of courses_bought) {
        let consulta_specific_course = "SELECT * FROM courses WHERE id = ?";
        let specific_course = await realizarConsulta(consulta_specific_course, [course.course_id]);
        all_courses.push(specific_course[0])
    }

    res.render('profile/profile', { user, courses_owned, courses_bought: all_courses,users });

})





// ----------POST PARA ACTUALIZAR DATOS DEL USUARIO--------------
router.post('/account', isAuthenticated, async (req, res) => {
    try {
        let { username_form, phone_form, biography_form, pass_form, pass_form_repeat } = req.body;
        let user_id = req.session.myuser.id;

        let consulta_find = "SELECT * FROM users WHERE id = ?";
        let results = await realizarConsulta(consulta_find, [user_id]);
        results = results[0];
        
        let changes = false;
        let message = "";

        // Si el username del formulario y el de la base de datos es diferente, quiere cambiarlo, asi que procedemos
        if (results.username != username_form) {
            let consulta_find_same_username = "SELECT * FROM users WHERE username = ?";
            let same_username = await realizarConsulta(consulta_find_same_username, [username_form]);
            
            if (same_username.length > 0) {
                res.render('profile/account', {
                    username: results.username,
                    phone: results.phone,
                    type: results.type,
                    message: "Ese nombre de usuario ya está en uso",
                    biography: results.biography
                });
                return;
            } else {
                let consulta_update = "UPDATE users SET username = ? WHERE id = ?";
                await realizarConsulta(consulta_update, [username_form, user_id]);
                results.username = username_form; // Actualizar el objeto results
                changes = true;
                console.log("Username cambiado");
            }
        }

        // Si el phone del formulario y el de la base de datos es diferente, quiere cambiarlo, asi que procedemos
        if (results.phone != phone_form) {
            let consulta_find_same_phone = "SELECT * FROM users WHERE phone = ?";
            let same_phone = await realizarConsulta(consulta_find_same_phone, [phone_form]);
            
            if (same_phone.length > 0) {
                res.render('profile/account', {
                    username: results.username,
                    phone: results.phone,
                    type: results.type,
                    message: "Ese número de teléfono ya está en uso",
                    biography: results.biography
                });
                return;
            } else {
                let consulta_update = "UPDATE users SET phone = ? WHERE id = ?";
                await realizarConsulta(consulta_update, [phone_form, user_id]);
                results.phone = phone_form; // Actualizar el objeto results
                changes = true;
                console.log("Phone cambiado");
            }
        }

        // Si alguno de los campos contraseña no está vacío, es que quiere cambiar la contraseña
        if (pass_form && pass_form_repeat) {
            if (pass_form != pass_form_repeat) {
                res.render('profile/account', {
                    username: results.username,
                    phone: results.phone,
                    type: results.type,
                    message: "Las contraseñas no coinciden",
                    biography: results.biography
                });
                return;
            } else {
                let salt = await bcrypt.genSalt(saltRounds);
                let hash = await bcrypt.hash(pass_form, salt);
                let consulta_update = "UPDATE users SET password = ? WHERE id = ?";
                await realizarConsulta(consulta_update, [hash, user_id]);
                changes = true;
                console.log("Contraseña cambiada");
            }
        }

        // Actualizar biography
        if (results.biography !== biography_form) {
            let consulta_update = "UPDATE users SET biography = ? WHERE id = ?";
            await realizarConsulta(consulta_update, [biography_form, user_id]);
            results.biography = biography_form; // Actualizar el objeto results
            changes = true;
            console.log("Biography cambiada");
        }

        if (changes) {
            message = "Los datos han sido cambiados con éxito.";
        }

        res.render('profile/account', {
            username: results.username,
            phone: results.phone,
            type: results.type,
            message,
            biography: results.biography
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error en el servidor");
    }
});

router.post('/change_image', upload.single('file'), isAuthenticated, async (req, res) => {
    let user_id = req.session.myuser.id;
    const folderName = "pfp";
    const file_name = `${uuidv4()}.jpg`;

    console.log("CHANGE IMAGE")
    try {
        console.log("Intentando subir imagen")
        await upload_image_to_server(folderName, req.file, file_name);
        console.log("Imagen subida")
        let consulta_update = "UPDATE users SET pfp = ? WHERE id = ?";
        await realizarConsulta(consulta_update, [file_name, user_id]);
        res.locals.myuser.mypfp=file_name
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error subiendo la imagen');
    }
});


module.exports = router
