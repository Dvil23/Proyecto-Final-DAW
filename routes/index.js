const db = require('../db')
const express = require('express')
const router = express()
const fs = require('fs')
const bcrypt = require('bcrypt')

require('dotenv').config()

const multer  = require('multer')
const upload = multer({ storage: multer.memoryStorage({ inMemory: true }) })

const saltRounds = 10

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


// libreria ssh2 y su configuración
const { Client } = require('ssh2')
const sshConfig = {
  host: process.env.SSH_host,
  port: process.env.SSH_port,
  username: process.env.SSH_user,
  privateKey: require('fs').readFileSync(process.env.ssh_key_path)
}

// ---------------
// Tareas por hacer:
// En el perfil de usuario, acceso a crear nuevo curso
// Que los campos del register y login no se borren si fallas
// ----------------

// Mi landing page
router.get('/', (req, res, next) => {
  res.render('index', { message: "aphelios" , test: ""})
})


router.post('/upload', upload.single('file'), (req, res) => {

  const folderName = req.body.folderName

  // Configuración de la conexión SSH
  const conn = new Client()
  conn.on('ready', () => {
    console.log('Conexión SSH establecida')

    conn.sftp((err, sftp) => {

      //Creamos carpeta pra almacenar el video (si el campo está vacio, no crea nada)
      //Añadir a esta linea { recursive: true } si en el futuro necesito crear mas de una carpeta
      sftp.mkdir('/var/www/html/videos/' + folderName, (err) => {

        // Guardar el archivo en la carpeta
        sftp.writeFile('/var/www/html/videos/' + folderName + '/' + req.file.originalname, req.file.buffer, (err) => {

          conn.end()

          res.render('index', { test: 'Archivo guardado en la carpeta: ' + folderName})
        })
      })
    })
  }).connect(sshConfig)
})

//Ver videos si pones su ruta en el formulario
router.post('/view', (req, res, next) => {
  console.log(req.body.file_path)
  res.render('view', { message: req.body.file_path })
})




// ------------------REGISTER------------------
router.get('/register', (req, res, next ) => {
  res.render('register', { message: ""})
})


//Manejar el formulario de registro
router.post('/register', (req, res, next ) => {

  let { username, email, password, repeat_password, phone } = req.body
  
  //Check para mirar que se han rellenado todos los campos
  if (username=="" || email=="" || password=="" || phone==""){
    res.render('register',{ message: "Porfavor, rellene todos los campos."})
    
    return
  }

  if (password != repeat_password){
    res.render('register',{ message: "Las contraseñas no coinciden."})
    return
  }

  let consulta_check="SELECT * FROM users WHERE username = ? OR email = ?"

  //Check para ver si ya existe el Email o usuario en la base de datos
  db.query(consulta_check,[username,email],(error,results)=>{

    //Si existe, pone nombre de error
    if(results.length > 0){
      res.render('register',{ message: "El nombre de usuario o email ya está en uso."})
    }
    // INSERT
    else{

      bcrypt.genSalt(saltRounds, function(err, salt) {
        bcrypt.hash(password, salt, function(err, hash) {

          let consulta_insert="INSERT INTO users (username, email, password, type, phone, pfp) VALUES (?, ?, ?, ?, ?, ?)"
          db.query(consulta_insert, [username, email, hash, 0, phone, "default_pfp"])

        })
      })
      
      res.redirect('/login')
    }
  })
})

// ------------------Login------------------
router.get('/login', (req, res, next ) => {
  res.render('login', { message: ""})
})


//Manejar el formulario de login
router.post('/login', (req, res, next) => {

  let { email, password } = req.body

  let consulta_check = "SELECT * FROM users WHERE email = ?"

  db.query(consulta_check, [email], (error, results) => {

    if (results.length > 0) { //Existe el email

      //Hashear la contraseña y compararla con el resultado de la base de datos
      bcrypt.compare(password, results[0].password, (err, correct) => {

        //Si todos los datos son correctos, inicia sesión y te redirecciona
        if (correct) {
          
          req.session.user= {
            id: results[0].id,
            pfp: results[0].pfp
          }

          res.redirect('/')

        } else { //Existe el email, pero no coincide con la contraseña
          res.render('login', { message: "El email y contraseña son incorrectos, o no existen" })
        }
      })
    } else { //No existe el email
      res.render('login', { message: "El email y contraseña son incorrectos, o no existen" })
    }
  })
})

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
        console.error('Error al cerrar sesión:', err);
    } else {
        console.log('Sesión cerrada correctamente.');
        res.redirect('/'); // Redirige a la página principal u otra página después de cerrar sesión
    }
  })
})



module.exports = router

