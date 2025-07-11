    // app.js (Fixed and Improved Version)

    // 1. Import necessary modules using ES Module syntax
    //    We use 'import' instead of 'require' because we'll enable "type": "module" in package.json
    import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb'; // From native MongoDB driver
    import express from 'express'; // Import Express
    import session from 'express-session';
    import path from 'path';
    import { fileURLToPath } from 'url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // // 2. Load environment variables (like MONGO_URI) from .env file
    // //    This should be at the very top of your main entry file.
    // import 'dotenv/config'; // Modern way to load dotenv

    // 3. Initialize Express app and port
    const app = express(); // Instance for Express application
    app.use(session({
    secret: 'CSt 2120 secret',
    cookie: { maxAge: 60000 }, // session lasts 1 minute
    resave: false,
    saveUninitialized: true
    }));

    const PORT = 3000;     // The port for our server URL

    // 4. Declare global variables to hold database and collection references
    //    These will be assigned once connectToDatabase runs successfully
    let database;
    let itemsCollection; // This will replace your in-memory 'items' array
    let usersCollection;


    // 5. MongoDB Connection Function (using your provided structure)
    async function connectToDatabase() {
        try {
            // Get the MongoDB connection URI from environment variables
            // Ensure your .env file has: MONGO_URI=mongodb://localhost:27017/your_database_name
            const connectionURI = process.env.MONGO_URI || "mongodb://localhost:27017/default_db_name";

            const client = new MongoClient(connectionURI, {
                serverApi: {
                    version: ServerApiVersion.v1,
                    strict: true, // Set to true for stricter query validation (recommended)
                    deprecationErrors: true
                }
            });

            await client.connect(); // Attempt to connect to the MongoDB server
            console.log('Connected to MongoDB! 💾');

            // Assign the database object to the global 'database' variable
            database = client.db("vandelbusters!"); // Your chosen database name

            // Get a reference to the 'items' collection and assign it globally
            itemsCollection = database.collection("items"); // The collection for your items
            usersCollection = database.collection("users");
            console.log('"items" collection reference obtained.');
            console.log('"users" collection reference obtained.');

        } catch (err) {
            console.error('Failed to connect to MongoDB:', err);
            // Exit the process if database connection fails, as the app can't function without it
            process.exit(1);
        }
    }
// Serve frontend files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

    // 6. Middleware to parse JSON data from incoming requests
    //    This translates JSON text in the request body into a JavaScript object on req.body
    app.use(express.json());

    // --- REMOVED: In-memory 'items' array and 'nextId' ---
    // We will now use itemsCollection from MongoDB instead!


    // --- API Endpoints ---

    // GET /first: Basic connection test
    app.get('/first', (req, res) => {
        res.send('You\'ve successfully connected!');
    });

    // GET /second: Another basic test
    app.get('/second', (req, res) => {
        res.send("This is my second get!")
    });

    // GET /items: Retrieve all items from MongoDB
    // This function is now 'async' because database operations are asynchronous
    app.get('/items', async (req, res) => {
        console.log('GET /items request received.');
        try {
            // Find all documents in the 'items' collection and convert to an array
            const allItems = await itemsCollection.find({}).toArray();
            res.status(200).json(allItems);
        } catch (error) {
            console.error('Error fetching items from DB:', error);
            res.status(500).json({ message: "Failed to retrieve items." });
        }
    });

    // POST /items: Add a new item to MongoDB
    // This function is now 'async' because database operations are asynchronous
    app.post('/items', async (req, res) => {
        // console.log('POST /items request received. Body:', req.body);

        const username = req.session.username;
        if (!username) {
            return res.status(401).json({ message: "You must be logged in to add items!" });
        }

        const newItem = {
            name: req.body.name,
            price: req.body.price,
            owner: username // <--- Add the logged-in user
        };

        // Basic validation
        if (!newItem.name || typeof newItem.price !== 'number' || newItem.price <= 0) {
            return res.status(400).json({ message: "Name (string) and positive Price (number) are required!" });
        }

        try {
            // Insert the new item into the 'items' collection
            const result = await itemsCollection.insertOne(newItem);
            console.log(`New item inserted with _id: ${result.insertedId}`);

            // Respond with the created item (MongoDB adds the _id)
            // We can fetch the inserted document or use the original newItem with the new _id if we want.
            // For simplicity, we'll respond with the newItem and the generated _id.
            res.status(201).json({ ...newItem, _id: result.insertedId });
        } catch (error) {
            console.error('Error inserting item into DB:', error);
            res.status(500).json({ message: "Failed to create item." });
        }
    });

    app.get('/items/:id', async (req, res) => {
        try {
            const itemId = req.params.id;
            // Ensure you import ObjectId from 'mongodb' at the top of your app.js
            const item = await itemsCollection.findOne({ _id: new ObjectId(itemId) });
            // --- THE MISSING IF CONDITION IS HERE ---
            if (!item) { // Check if 'item' is null (meaning no document was found)
                return res.status(404).json({ message: "Item not found!" });
            }
            // --- END OF MISSING IF CONDITION ---

            // If an item WAS found, then proceed to send it with 200 OK
            res.status(200).json(item);

        } catch (err) {
            // This catch block handles errors like invalid ObjectId format,
            // or actual database connection issues.
            console.error('Error fetching item from DB:', err);
            // Using 400 Bad Request if the ID format is invalid, otherwise 500 for server errors
            if (err.name === 'BSONTypeError' || err.message.includes('Cast to ObjectId failed')) {
                res.status(400).json({ message: "Invalid item ID format." });
            } else {
                res.status(500).json({ message: "Failed to retrieve item due to server error." });
            }
        }
    });

    app.put('/items/:id', async (req, res) => {
        // Log the incoming request and body for debugging
        console.log(`PUT /items/${req.params.id} request received. Body:`, req.body);

        try {
            const itemId = req.params.id; // Get the ID from the URL parameter

            // Validate the incoming request body
            // Ensure that at least one field (name or price) is provided for update
            if (Object.keys(req.body).length === 0) {
                return res.status(400).json({ message: "Request body cannot be empty for update." });
            }

            // Optional: Basic validation for specific fields if they exist in the body
            if (req.body.name && typeof req.body.name !== 'string') {
                return res.status(400).json({ message: "Name must be a string if provided." });
            }
            if (req.body.price && typeof req.body.price !== 'number' || req.body.price <= 0) {
                return res.status(400).json({ message: "Price must be a positive number if provided." });
            }

            // --- Perform the Update Operation ---
            // updateOne() returns a Promise that resolves to an object with info about the update
            const updateResult = await itemsCollection.updateOne(
                { _id: new ObjectId(itemId) }, // Filter: Find the document by its MongoDB ObjectId
                { $set: req.body }            // Update operator: $set updates only the fields provided in req.body
            );

            // --- Check the Update Result ---
            // updateResult.matchedCount: Number of documents that matched the filter
            // updateResult.modifiedCount: Number of documents that were actually modified
            if (updateResult.matchedCount === 0) {
                // If no document was found with the given ID
                return res.status(404).json({ message: `Item with ID ${itemId} not found.` });
            }

            if (updateResult.modifiedCount === 0) {
                // If the item was found but no fields were actually changed (e.g., sent same data)
                return res.status(200).json({ message: `Item with ID ${itemId} found, but no changes applied (data was identical).` });
            }

            // If the item was found AND modified
            res.status(200).json({ message: `Item with ID ${itemId} updated successfully!` });

        } catch (error) {
            // --- Centralized Error Handling for PUT request ---
            console.error('Error updating item:', error);

            // Check for specific error types (e.g., if the ID format is invalid)
            if (error.name === 'BSONTypeError' || error.message.includes('Cast to ObjectId failed')) {
                // MongoDB throws BSONTypeError if new ObjectId() gets an invalid string
                return res.status(400).json({ message: "Invalid item ID format." });
            } else {
                // Catch any other unexpected server-side errors
                return res.status(500).json({ message: "Failed to update item due to server error." });
            }
        }
    });

    app.post('/register', async (req, res) => {
        console.log('POST /register request received. Body:', req.body);
        const {username, password} = req.body;
        if(!username || !password){
        return res.status(400).json({message: "Username and Password must be entered to continue."});
        }
        if(password.length < 6){
            return res.status(400).json({message: "Password should be more than 6 charcaters"});
        }
        try{
            const exsitingUser = await usersCollection.findOne({username: username});
            if(exsitingUser){
                return res.status(409).json("Username taken.");
            }
            const user = {
                username: username,
                password: password
            }

            const addUser = await usersCollection.insertOne(user);
            res.status(201).json({message: "User added", userId: addUser.insertedId});
        }
        catch(err){
            console.log("Error", err)
            res.status(500).json({message: "Server error has occcured!"});
        }
        
    });

    app.post('/login', async (req, res) => {
        const {username, password} = req.body;
        if(!username || !password){
            return res.status(400).json({message: "Username and Password cannot be empty!"});
        }
    try{
        const userAvailable = await usersCollection.findOne({username: username, password: password});

        if(userAvailable){
            req.session.username = username;  // Save username in session

            res.status(200).json({message: "You have logged in!"});
        }
        else{
            res.status(400).json({message: "Sorry no user available!"});
        }
    }
    catch(err){
        res.status(400).json({message: "An error has occured!", err});
    }


    });

    app.post('/logout', (req, res) => {
        req.session.destroy(err => {
            if(err){
                res.status(500).json({message: "Logout failed!"});
            }
            else{
                res.status(200).json({message: "Logout successful!"});
            }
        });
    });


    app.get('/profile', async(req, res) => {
        const username = req.session.username;

        if(!username){
        return res.status(401).json({message: "You must be logged in to see your profile!"});
        }

        try{
            const foundUser = await usersCollection.findOne({username});
            if (!foundUser){
                res.status(401).json({message: "User not found!"});
            }
            res.status(200).json({foundUser});
        }
        
        catch(err){
            res.status(400).json({message: "An error has occured!"});
        }

    });

    app.delete('/profile', async (req, res) => {
        const username = req.session.username;

        if(!username){
            return res.status(401).json({message: "You need to be logged in to continue!"});
        }

        try{
            const userFound = await usersCollection.deleteOne({username});
            if(userFound.deletedCount === 0){
                return res.status(404).json({ message: "User not found." });
            }
            req.session.destroy();
            res.status(200).json({message: "Your account has been deleted!"});
        }

        catch{
            res.status(500).json({ message: "Error deleting account.", error: err });
        }
    });

    app.get('/my-items', async (req, res) => {
        const username = req.session.username;

        if (!username) {
            return res.status(401).json({ message: "You need to login first!" });
        }

        try {
            const userItems = await itemsCollection.find({ owner: username }).toArray();

            // No need to check if `userItems` is falsy — .toArray() always returns an array.
            // But you can check if it's empty, if you want.
            if (userItems.length === 0) {
                return res.status(404).json({ message: "No items found for this user." });
            }

            res.status(200).json(userItems); // No need to wrap in `{ userItems }`, just return the array

        } catch (err) {
            console.error("Error in /my-items:", err);
            res.status(500).json({ message: "An error has occurred!", error: err });
        }
    });


    app.delete('/my-items/:id', async (req, res) => {
        const username = req.session.username;

        if (!username) {
            return res.status(401).json({ message: "You need to login first!" });
        }

        const id = req.params.id;

        try {
            const userItems = await itemsCollection.deleteOne({ _id: new ObjectId(id), owner: username });

            if (userItems.deletedCount === 0) {
                return res.status(404).json({ message: "Item not found or not yours." });
            }

            res.status(200).json({ message: "Successfully deleted!", userItems });
        } catch (error) {
            console.log("An error has occurred, check your code pls!", error);
            res.status(500).json({ message: "Something has happened! :(" });
        }
    });

    // 7. Start the server ONLY AFTER successfully connecting to the database
    //    Wrap app.listen in an async function and call connectToDatabase inside it.
    async function startApplication() {
        await connectToDatabase(); // Wait for the database connection

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
            console.log('Press Ctrl+C to stop the server.');
        });
    }

    // Call the async function to start the entire application
    startApplication();