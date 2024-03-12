const express = require('express');
const cors = require('cors');
const mongodb = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

// connect to Mongo database
const MongoClient = mongodb.MongoClient;

// create a shortcut to mongodb.ObjectId
const ObjectId = mongodb.ObjectId;

// create the express app
const app = express();

//enable cors
//enable json for receiving requests and sending responses
app.use(cors());
app.use(express.json());

async function connect(uri, dbname) {
    // connect to the latest structure for Mongo
    const client = await MongoClient.connect(uri);
    let db = client.db(dbname);
    return db;
}

// jwt (aka access token)
function generateAccessToken(id, email){
    // 1. store payload
    // 2. store token secret
    // 3. store option object
    return jwt.sign({
        "user_id": id,
        "email": email
    }, process.env.TOKEN_SECRET, {
        'expiresIn': '3d'
    });
}

// middleware function to check if a valid JWT has been provided
function authenticateWithJWT(req,res,next){
    const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.split(" ")[1];
            jwt.verify(token, process.env.TOKEN_SECRET, function(err,payload){
                if(err) {
                    res.status(400);
                    return res.json({
                        'error': err
                    })
                } else {
                    req.payload = payload;
                    next();
                }
            })
        } else {
            res.status(400);
            res.json({
                'error': 'Login required to access this route'
            })
        }
}


async function main() {
    const uri = process.env.MONGO_URI;
    const db = await connect(uri, "dental_clinic");

    // READ 
    app.get('/patients', async function (req, res) {
        try {
            const results = await db.collection("patients").find({}).toArray();
            res.json({
                "patients": results
            })
        } catch (e) {
            res.status(500);
            res.json({
                'error': 'Internal server error'
            })
        }
    });

    // CREATE 
    app.post('/patient', async function (req, res){
        try {
            const name = req.body.name;
            const dob = req.body.dob;
            const gender = req.body.gender;
            const address = {
                "street_name": req.body.address.street_name,
                "block_number": req.body.address.block_number,
                "unit_number": req.body.address.unit_number,
                "postal_code": req.body.address.postal_code
            };
            
            const appointment_date_time = req.body.appointment_date_time; // Assuming it's provided in the request body
            const dentistName = req.body.dentist_id; // Extracting dentist's name directly from the request body
    
            // Find the dentist by name
            const dentist = await db.collection("dentists").findOne({ name: dentistName });
    
            // Check if dentist is found
            if (!dentist) {
                res.status(400);
                return res.json({
                    'error': 'A valid dentist name must be provided'
                });
            }
    
            const result = await db.collection("patients").insertOne({
                "name": name,
                "dob": dob,
                "gender": gender,
                "address": address,
                "appointment_date_time": appointment_date_time,
                "dentist_id": new ObjectId(dentist._id) // Assuming dentist _id is used as the dentist_id
            });
    
            res.json({
                'result': result
            });
        } catch (e) {
            console.error(e);
            res.status(500);
            res.json({
                'error': 'Internal server error'
            });
        }
    });    
    
    // UPDATE
    app.put('/patient/:id', async function (req, res){
        try {
            const name = req.body.name;
            const dob = req.body.dob;
            const gender = req.body.gender;
            const address = {
                "street_name": req.body.address.street_name,
                "block_number": req.body.address.block_number,
                "unit_number": req.body.address.unit_number,
                "postal_code": req.body.address.postal_code
            };
            
            const appointment_date_time = req.body.appointment_date_time; // Assuming it's provided in the request body
            const dentistName = req.body.dentist_id; // Extracting dentist's name directly from the request body
    
            // Find the dentist by name
            const dentist = await db.collection("dentists").findOne({ name: dentistName });
    
            // Check if dentist is found
            if (!dentist) {
                res.status(400);
                return res.json({
                    'error': 'A valid dentist name must be provided'
                });
            }
    
            const result = await db.collection("patients").updateOne({
                '_id': new ObjectId(req.params.id)
            }, {
                '$set':{
                    'name': name,
                    'dob': dob,
                    'gender': gender,
                    'address': address,
                    'appointment_date_time': appointment_date_time,
                    "dentist_id": new ObjectId(dentist._id) // Corrected dentist reference
                }
            });
    
            res.json({
                'result': result
            });
    
        } catch (e) {
            console.error(e);
            res.status(500);
            res.json({
                'error': 'Internal Server Error'
            });
        }
    });    

    app.delete('/patient/:id', async function (req,res){
        try {
            await db.collection("patients").deleteOne({
                '_id': new ObjectId(req.params.id)
            });
            res.json({
                'message': 'Patient deleted.'
            });
        } catch (e) {
            res.status(500);
            res.json({
                'error': 'Internal Server Error'
            });
        }
    })

    app.post('/user', async function (req, res){
        const hashedPassword = await bcrypt.hash(req.body.password, 12);
        let result = await db.collection("users").insertOne({
            "email":req.body.email,
            "password": hashedPassword
        });
        res.status(201);
        res.json({
            'result':result,
            'message': 'New user account'
        })
    });

    app.post('/login', async function (req,res){
        const user = await db.collection("users").findOne({ email: req.body.email });

        if (user){
            if (await bcrypt.compare(req.body.password, user.password)) {
                const token = generateAccessToken(user._id, user.email);
                res.json({
                    'token': token 
                })
            } else {
                res.status(401);
                res.json({
                    'error':'Invalid login credentials'
                })
            }
        } else {
            res.status(404);
            return res.json ({
                'error': 'Invalid login credentials'
            })
        }
    })

    app.get('/profile', authenticateWithJWT, async function (req,res){
        res.json({
            'message': 'success in accessing protected route',
            'payload': req.payload
        })
    });

    app.get('/payment', authenticateWithJWT, async function (req, res){
        res.json({
            'message':'accessing protected payment route'
        })
    });
}

main();

app.listen(3000, function () {
    console.log("Server has started");
})