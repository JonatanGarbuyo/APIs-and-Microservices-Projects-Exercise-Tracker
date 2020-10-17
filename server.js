'use strict';
const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const cors = require('cors');
var mongo = require('mongodb');
const mongoose = require('mongoose');

// Mongoose
mongoose.connect(process.env.MLAB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true, 
  useFindAndModify: true 
});

const Schema = mongoose.Schema;

// Schemas //
const UsersSchema = new Schema({
  "username": {"type": "String", "required": true, "unique": true}
}, {
    "versionKey": false
});

  // validate duration. could be option min. ej: {min: [6, 'duration too short']}  or custom validator:
const ExercisesSchema = new Schema({
  "userId": {type: String, required: true},
  "description": {type: String, required: true},
  "duration": { type: Number, 
               required: true,
               validate : {
                  validator : Number.isInteger,
                  message   : "{VALUE} is not an integer value"
                }
              },
  "date": { "type": Date },
  "username": {"type": String},
}, { "versionKey": false });

// Models //
const Users = mongoose.model("Users", UsersSchema);
const Exercises = mongoose.model("Exercises", ExercisesSchema);


app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// POST Routes //
  // add User
app.post("/api/exercise/new-user", function(req, res) {
  let newUser = new Users({"username": req.body.username});
  newUser.save(function(err, doc){
    if (err) return res.send(err.message.split(":")[2]);
    res.json(doc);
  });
});

  // add Exercise
app.post("/api/exercise/add", function(req, res) {
  let resData = {};
  // If no date supplied it will use current date.
  req.body.date = req.body.date? req.body.date : new Date();
  
  let exercise = new Exercises(req.body);
  // check if user is valid
  Users.findById(req.body.userId, function(err, doc) {
    if (err) return res.send(err.message);
  
    // add username
  resData.username = doc.username;
  resData._id = doc._id;
  });
  
  // save data to DB
  exercise.save(function(err, data) {
    if (err) return res.send(err.message.split(":")[2]);  
    resData.description = data.description;
    resData.duration = data.duration;
    //format date
    resData.date = new Date(data.date).toDateString();
    res.json(resData);
  });
});


// GET Routes //
  // get users
app.get("/api/exercise/users", function(req, res){
  Users.find()
    .exec(function(err, docs){
    if (err) return res.send(err.message);
    res.send(docs);
  });
});

// get exercises
app.get("/api/exercise/log", function(req, res) {
  let resData = {}
  
  // find the user
  Users.findById({"_id": req.query.userId}, function(err, doc){
    if (err) return res.send(err.message);
    resData.userId = doc._id;
    resData.username = doc.username
  })
  
  // find the user exercises
  Exercises.find({ 
    "userId": req.query.userId,
    $and: [
      {"date": { $gte: req.query.from? req.query.from : new Date(0)}},
      {"date": { $lte: req.query.to?   req.query.to   : Date.now()}}]
  })
  .select("-_id description duration date")
  .limit(parseInt(req.query.limit, 10))
  .exec(function(err, data) {
    if (err) return res.send(err.message);
    resData.count = data.length;
    resData.log = data.map(item => {
      return {
        "description": item.description,
        "duration": item.duration,
        "date": new Date(item.date).toDateString()
      };
    });
    res.json(resData);
  }); 
});


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res.status(errCode).type('txt')
    .send(errMessage);
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
