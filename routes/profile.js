const db = require('../db')
const express = require('express')
const router = express()
const bcrypt = require('bcrypt')

require('dotenv').config()

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

router.get('/', (req, res) => {
    res.render('profile')
});

router.get('/account', (req, res) => {
    let consulta_check="SELECT * FROM users WHERE id = ?"
    try{
        db.query(consulta_check,[req.session.user.id],(error,results)=>{
            results = results[0]
            res.render('profile/account',{username: results.username, phone: results.phone, type: results.type, message: ""})
            
        })
    } catch {
        //Si no encuentra, es que no estás logeado
        res.redirect('/')
        return
    }
});

router.get('/password', (req, res) => {
    res.render('profile/password',{message:""})
});
router.get('/wishlist', (req, res) => {
    res.render('profile/wishlist')
});
router.get('/deactivate', (req, res) => {
    res.render('profile/deactivate')
});


//ACTUALIZAR USERNAME Y PHONE DEL USUARIO
router.post('/account', (req, res) => {

    username_form=req.body.username_form
    phone_form=req.body.phone_form

    try{
        let consulta_check="SELECT * FROM users WHERE username = ?"
        db.query(consulta_check,[username_form],(error,results)=>{

            results = results[0]

            if (results==undefined){ 
                //SI EL NOMBRE DE USUARIO NO EXISTE, LO CAMBIA
                let consulta_update="UPDATE users SET username = ?, phone = ? WHERE id = ?"
                db.query(consulta_update,[username_form,phone_form,req.session.user.id])
                res.redirect('/profile')
            }else{  
                //SI EL NOMBRE DE USUARIO YA EXISTE, NO LO CAMBIA
                res.render('profile/account',{username: results.username, phone: results.phone, type: results.type, message:"Ya hay un usuario con ese nombre"})
            }
        })
    } catch {  res.redirect('/') }
});

//CAMBIAR CONTRASEÑA
router.post('/password', (req, res) => {

    pass=req.body.pass_form
    pass_repeat=req.body.pass_form_repeat

    if (pass!=pass_repeat){ 
        //SI NO COINCIDEN LAS CONTRASEÑAS
        res.render('profile/password',{message:"Las contraseñas no coinciden"})
    }else{

        let consulta_check="SELECT * FROM users WHERE id = ?"
        db.query(consulta_check,[req.session.user.id],(error,results)=>{
            bcrypt.compare(pass, results[0].password, (err, correct) => {

                if(correct){ 
                    //SI ES LA MISMA CONTRASEÑA DE ANTES
                    res.render('profile/password',{message:"No puedes cambiar la contraseña a tu contraseña antigua"})
                }else{ 
                    //SI ES UNA NUEVA CONTRASEÑA
                    bcrypt.genSalt(saltRounds, function(err, salt) {
                        bcrypt.hash(pass, salt, function(err, hash) {
                            let consulta_update="UPDATE users SET password = ? WHERE id = ?"
                            db.query(consulta_update,[hash,req.session.user.id])
                            res.redirect('/profile')
                        })
                    })
                }
            }) 
        })    
    }
})



module.exports = router
