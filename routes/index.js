const db = require('../db')
const express = require('express')
const router = express()
const fs = require('fs')
require('dotenv').config()

const { Client } = require('ssh2')

const multer  = require('multer')
const upload = multer({ storage: multer.memoryStorage({ inMemory: true }) })

const sshConfig = {
  host: process.env.SSH_host,
  port: process.env.SSH_port,
  username: process.env.SSH_user,
  privateKey: require('fs').readFileSync(process.env.ssh_key_path)
}

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

// Ver videos si pones su ruta en el formulario
router.post('/view', (req, res, next) => {
  console.log(req.body.file_path)
  res.render('view', { message: req.body.file_path })
})

// Mi landing page
router.get('/', function(req, res, next) {
  res.render('index', { message: "aphelios" , test: ""})
})







// Conexión a base de datos (No definitiva, de prueba) y consulta
router.get('/basedatos', (req, res, next) => {

  db.query('SELECT * FROM actor', (err, result) => {
    if (err) {
      console.error('Error al consultar la base de datos:', err)
      res.status(500).send('Error de servidor')
      return
    } else{
      res.json(result)
    }
    
  })
})



module.exports = router;

