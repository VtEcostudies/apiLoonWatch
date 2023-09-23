const nodemailer = require('nodemailer');
const config = require('config.js');
//const os = require("os");
//const host = os.hostname();
//const env = os.hostname()=='vpatlas.org'?'prod':('dev.vpatlas.org'?'dev-remote':'dev-local');
const env = require('apiUtility/apiEnv');

module.exports = {
    test: (userMail, interval) => reset(userMail, interval, 'test'), //use 'token' to pass 'interval'
    register: (userMail, token) => reset(userMail, token, 'registration'),
    reset: (userMail, token) => reset(userMail, token, 'reset'),
    new_email: (userMail, token) => reset(userMail, token, 'email')
};

/*
Send registration or reset email with token.
*/
function reset(userMail, token, type='registration') {

  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.vceEmail,
      pass: config.vcePassW
    },
    from: config.vceEmail
  });

  var htm = `<a href=${config.server[env.api_env]}/confirm/registration?token=${token}>Confirm VPAtlas Registration</a>`;
  var sub = 'VPAtlas Registration';
  if (type == 'reset') {
    htm = `<a href=${config.server[env.api_env]}/confirm/reset?token=${token}>Confirm VPAtlas Password Change</a>`;
    sub = 'VPAtlas Password Reset';
  }
  if (type == 'email') {
    htm = `<a href=${config.server[env.api_env]}/confirm/email?token=${token}>Confirm VPAtlas Email Change</a>`;
    sub = 'VPAtlas Email Change';
  }
  if (type == 'test') { //use 'token' to pass 'interval'
    htm = `This is a test email sent from VPAtlas at ${env.os_host} to verify it's able to send mail. 
    If you don't get the next email in ${token} seconds, you'll need to re-enable less secure apps
    in Google Workspace for the user vpatlas@vtecostudies.org.`;
    sub = 'VPAtlas Email Test';
  }

  var mailOptions = {
    from: config.vceEmail,
    to: userMail,
    subject: sub,
    html: htm
  };

  /*
  To make sendmail work, log-in to the sending gmail account and turn-on 'less secure app access':
  - https://myaccount.google.com/lesssecureapps
  */
  return new Promise(function(resolve, reject) {
      transporter.sendMail(mailOptions, function(err, info) {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        console.log('Email sent: ' + info.response);
        resolve(info);
      }
    });
  });

}
