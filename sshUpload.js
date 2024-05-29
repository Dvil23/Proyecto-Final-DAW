const { Client } = require('ssh2');
const fs = require('fs');

const sshConfig = {
  host: process.env.SSH_host,
  port: process.env.SSH_port,
  username: process.env.SSH_user,
  privateKey: fs.readFileSync(process.env.ssh_key_path)
};

const upload_to_server = (folderName, file, customFileName) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log('Conexión SSH establecida');

      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        // Crear carpeta si el campo folderName no está vacío
        const remoteFolderPath = `/var/www/html/videos/${folderName}`;
        sftp.mkdir(remoteFolderPath, { recursive: true }, (err) => {
          if (err && err.code !== 4) { // Code 4 is for 'failure' which may be because the directory already exists
            conn.end();
            return reject(err);
          }

          // Guardar el archivo en la carpeta con el nombre personalizado
          const remoteFilePath = `${remoteFolderPath}/${customFileName}`;
          sftp.writeFile(remoteFilePath, file.buffer, (err) => {
            conn.end();
            if (err) {
              return reject(err);
            }
            resolve(`Archivo guardado en la carpeta: ${folderName}`);
          });
        });
      });
    }).connect(sshConfig);
  });
};
  
const delete_from_server = (folderName, fileName) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log('Conexión SSH establecida');

      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        // Eliminar el archivo del servidor
        const remoteFilePath = `/var/www/html/videos/${folderName}/${fileName}`;
        sftp.unlink(remoteFilePath, (err) => {
          conn.end();
          if (err) {
            return reject(err);
          }
          resolve(`Archivo ${fileName} eliminado de la carpeta: ${folderName}`);
        });
      });
    }).connect(sshConfig);
  });
};

module.exports = { upload_to_server, delete_from_server };