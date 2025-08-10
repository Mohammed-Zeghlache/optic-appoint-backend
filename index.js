 require ('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Malades = require('./models/Malades');

const app = express();

// Middleware

// Allow both localhost (for dev) and Netlify (for production)

app.use(cors({
  origin: [
    'http://localhost:5173', // for development
    // 'https://opticien-tayeb-bey-msila.netlify.app' 
   'https://tayeb-bay-msila.netlify.app'// for production
  ]
}));




app.use(express.json());

// Constants
const WORKING_DAYS = [0, 1, 2, 3, 6]; // Sunday (0) to Thursday (4), Saturday (6)
const FIRST_APPOINTMENT_TIME = { hour: 10, minute: 45 }; // 10:45 AM
const LAST_APPOINTMENT_TIME = { hour: 17, minute: 30 };  // 5:30 PM
const APPOINTMENT_DURATION = 15; // minutes

// Calculate available slots per day
const calculateSlotsPerDay = () => {
  const startMinutes = FIRST_APPOINTMENT_TIME.hour * 60 + FIRST_APPOINTMENT_TIME.minute;
  const endMinutes = LAST_APPOINTMENT_TIME.hour * 60 + LAST_APPOINTMENT_TIME.minute;
  return Math.floor((endMinutes - startMinutes) / APPOINTMENT_DURATION) + 1; // +1 to include last slot
};
const APPOINTMENTS_PER_DAY = calculateSlotsPerDay();

// Helper function to get Algeria time
function getAlgeriaTime() {
  const now = new Date();
  // Algeria is UTC+1
  return new Date(now.getTime() + (60 * 60 * 1000));
}

// Helper function to get next working day (skips Friday)
function getNextWorkingDay(date) {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  // Skip Friday (5) - only Sunday (0) to Thursday (4) and Saturday (6) are working days
  while (!WORKING_DAYS.includes(nextDay.getDay())) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

// Helper function to format date
function formatAppointmentTime(date) {
  const options = {
    timeZone: 'Africa/Algiers',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleString('fr-DZ', options);
}

app.get('/', (req, res) => {
  res.send('Backend is working ✅');
});

// Create appointment

app.post('/malade', async (req, res) => {
  try {
    const { name, familyname, phone, typedeplainte } = req.body;

    if (!name || !familyname || !phone || !typedeplainte) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
    }

    if (!/^0[5-7]\d{8}$/.test(phone)) {
      return res.status(400).json({ error: 'Numéro de téléphone algérien invalide' });
    }

    const algeriaNow = getAlgeriaTime();
    let currentDay = getNextWorkingDay(algeriaNow);
    currentDay.setHours(0, 0, 0, 0);

    let appointmentDate;
    let appointmentNumber;
    let foundSlot = false;
    let attempts = 0;
    const maxAttempts = 365;

    while (!foundSlot && attempts < maxAttempts) {
      attempts++;

      // Find appointments for this specific day
      const dayStart = new Date(currentDay);
      const dayEnd = new Date(currentDay);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayAppointments = await Malades.find({
        appointmentDate: {
          $gte: dayStart,
          $lt: dayEnd
        }
      }).sort({ appointmentNumber: 1 });

      if (dayAppointments.length < APPOINTMENTS_PER_DAY) {
        appointmentNumber = dayAppointments.length + 1;
        const totalMinutes = FIRST_APPOINTMENT_TIME.hour * 60 + FIRST_APPOINTMENT_TIME.minute + 
                             ((appointmentNumber - 1) * APPOINTMENT_DURATION);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        appointmentDate = new Date(currentDay);
        appointmentDate.setHours(hours, minutes, 0, 0);
        foundSlot = true;
      } else {
        currentDay = getNextWorkingDay(currentDay);
      }
    }

    if (!foundSlot) {
      throw new Error('Could not find available appointment slot');
    }

    const newAppointment = new Malades({
      name,
      familyname,
      phone,
      typedeplainte,
      appointmentDate,
      appointmentTime: formatAppointmentTime(appointmentDate),
      appointmentNumber
    });

    await newAppointment.save();

    res.status(201).json({
      message: 'Rendez-vous créé avec succès',
      appointment: {
        name: newAppointment.name,
        familyname: newAppointment.familyname,
        phone: newAppointment.phone,
        typedeplainte: newAppointment.typedeplainte,
        appointmentTime: newAppointment.appointmentTime,
        appointmentNumber: newAppointment.appointmentNumber,
        dayOfWeek: appointmentDate.toLocaleString('fr-DZ', { weekday: 'long' })
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});



// Database connection with retry logic
const connectWithRetry = () => {
  mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/optician-clinic', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection ', err);
    setTimeout(connectWithRetry, 5000);
  });
};

connectWithRetry();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('🚀 Server running on port ${PORT}');
  // console.log(Working days: ${WORKING_DAYS.map(d => ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][d]).join(', ')});
  // console.log(First appointment at: ${FIRST_APPOINTMENT_TIME.hour}:${FIRST_APPOINTMENT_TIME.minute});
  // console.log(Last appointment at: ${LAST_APPOINTMENT_TIME.hour}:${LAST_APPOINTMENT_TIME.minute});
  // console.log(Appointments per day: ${APPOINTMENTS_PER_DAY});
});
