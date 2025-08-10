//  mongoose = require("mongoose")
// const maladeschema = new mongoose.Schema({
//   name: { type: String, required: true },
//   familyname: { type: String, required: true },
//   phone: { type: String, required: true },
//   typedeplainte: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now },
//   appointmentTime: { type: String } 
// });

// const Malades = mongoose.model('Les-malades' , maladeschema);
// module.exports = Malades 

const mongoose = require('mongoose');

const maladeSchema = new mongoose.Schema({
  name: String,
  familyname: String,
  phone: String,
  typedeplainte: String,
  appointmentTime: String,
  appointmentDate: Date,
  appointmentNumber: Number
}, { timestamps: true });

module.exports = mongoose.model('Malades', maladeSchema);
