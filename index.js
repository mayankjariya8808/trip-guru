require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 5500 ;


const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/tripDB";

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// Define Mongoose Schema & Model
const bookingSchema = new mongoose.Schema({
  email: { type: String, required: true },
  contact: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  date: String,
  startDate: String,
  endDate: String,
  passenger: { type: Number, required: true },
  tripType: { type: String, enum: ["oneway", "roundtrip"], required: true },
  paymentAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model("Booking", bookingSchema);
const packageBookingSchema = new mongoose.Schema({
  package: { type: String, required: true },
  email: { type: String, required: true },
  contact: { type: String, required: true },
  passenger: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  paymentAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
});

const PackageBooking = mongoose.model("PackageBooking", packageBookingSchema);

// **3. API Routes (Updated to /packagebookings)**

// 👉 **POST API - Save Booking Data**
app.post("/packagebookings", async (req, res) => {
  try {
      const newBooking = new PackageBooking(req.body);
      await newBooking.save();

      // Send email notification
      sendBookingEmail(req.body);

      res.status(201).json({ message: "Booking successful!", booking: newBooking });
  } catch (error) {
      res.status(500).json({ error: "Failed to save booking" });
  }
});

// Function to send an email notification
async function sendBookingEmail(bookingData) {
  let transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
          user: "mkrajput8808@gmail.com",  // Replace with your email
          pass: "tuzvumbizncqfiha"         // Replace with your email password
      }
  });

  let mailOptions = {
      from: "your-email@gmail.com",
      to: "mayankjariyaa@gmail.com",
      subject: "New Package Booking Confirmation",
      text: `
          New package booking received:
          Email: ${bookingData.email}
          Contact No: ${bookingData.contact}
          Package Name: ${bookingData.packageName}
          Start Date: ${bookingData.startDate}
          End Date: ${bookingData.endDate}
          Number of Travelers: ${bookingData.travelers}
      `
  };

  try {
      await transporter.sendMail(mailOptions);
      console.log("Booking confirmation email sent!");
  } catch (error) {
      console.error("Error sending email:", error);
  }
}

// 👉 **GET API - Fetch All Bookings**
app.get("/packagebookings", async (req, res) => {
  try {
      const bookings = await PackageBooking.find();
      res.status(200).json(bookings);
  } catch (error) {
      res.status(500).json({ error: "Failed to fetch bookings" });
  }
});
// Update Package Booking
app.put("/packagebooking/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPackageBooking = await PackageBooking.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedPackageBooking) {
      return res.status(404).json({ error: "Package Booking not found" });
    }

    res.status(200).json({ message: "✏️ Package Booking updated successfully", updatedPackageBooking });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update Package Booking Payment Details
app.put("/packagebooking/payment/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentAmount, paymentStatus } = req.body;

    const updatedPackageBooking = await PackageBooking.findByIdAndUpdate(
      id,
      { paymentAmount, paymentStatus },
      { new: true }
    );

    if (!updatedPackageBooking) {
      return res.status(404).json({ error: "Package Booking not found" });
    }

    res.status(200).json({ message: "💰 Package Booking Payment updated successfully", updatedPackageBooking });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Trip Booking
app.post("/book", async (req, res) => {
  try {
    const { email, contact, from, to, date, startDate, endDate, passenger, tripType } = req.body;

    if (!email || !contact || !from || !to || !passenger || !tripType) {
      return res.status(400).json({ error: "❌ Missing required fields" });
    }

    const newBooking = new Booking({
      email,
      contact,
      from,
      to,
      date: tripType === "oneway" ? date : null,
      startDate: tripType === "roundtrip" ? startDate : null,
      endDate: tripType === "roundtrip" ? endDate : null,
      passenger,
      tripType
    });

    await newBooking.save();
    res.status(201).json({ message: "🎉 Booking successful!", booking: newBooking });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post("/send-notification", async (req, res) => {
  const { adminEmail, bookingDetails } = req.body;

  let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
          user: "mkrajput8808@gmail.com",
          pass: "tuzvumbizncqfiha" 
      }
  });

  let mailOptions = {
      from: "your-email@gmail.com",
      to: adminEmail,
      subject: "New Trip Booking Notification",
      text: `A new booking has been made:
      
      Trip Type: ${bookingDetails.tripType}
      From: ${bookingDetails.from}
      To: ${bookingDetails.to}
      Email: ${bookingDetails.email}
      Contact: ${bookingDetails.contact}
      Passengers: ${bookingDetails.passenger}
      ${bookingDetails.tripType === "oneway" ? `Date: ${bookingDetails.date}` : `Start Date: ${bookingDetails.startDate}\nEnd Date: ${bookingDetails.endDate}`}
      
      Please review the booking details.`
  };

  try {
      await transporter.sendMail(mailOptions);
      res.json({ message: "Notification email sent successfully!" });
  } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
  }
});

// Get All Bookings
app.get("/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a Booking
app.delete("/booking/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBooking = await Booking.findByIdAndDelete(id);

    if (!deletedBooking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.status(200).json({ message: "🗑️ Booking deleted successfully", deletedBooking });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update Booking
app.put("/booking/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBooking = await Booking.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

    if (!updatedBooking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.status(200).json({ message: "✏️ Booking updated successfully", updatedBooking });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update Payment Details
app.put("/booking/payment/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentAmount, paymentStatus } = req.body;

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { paymentAmount, paymentStatus },
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.status(200).json({ message: "💰 Payment updated successfully", updatedBooking });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Generate Invoice Image
app.post("/generate-invoice", async (req, res) => {
  try {
    const { contactNo, customerName, from, to, date, amount } = req.body;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    let htmlContent = fs.readFileSync("bill.html", "utf8");
    htmlContent = htmlContent.replace("John Doe", customerName).replace("City A", from).replace("City B", to).replace("01/01/2024", date).replace("1000", amount);
    await page.setContent(htmlContent);
    const filePath = `public/invoice-${Date.now()}.png`;
    await page.screenshot({ path: filePath, fullPage: true });
    await browser.close();
    const imageUrl = `http://127.0.0.1:5500/${filePath}`;
    const message = `Hello, here is your trip booking invoice:\n\nFrom: ${from}\nTo: ${to}\nDate: ${date}\nAmount: ₹${amount}\nInvoice: ${imageUrl}`;
    const whatsappURL = `https://wa.me/${contactNo}?text=${encodeURIComponent(message)}`;
    res.json({ success: true, imageUrl, whatsappURL });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/bookings/invoice/:id", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }
        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});
app.get("/packagebooking/invoice/:id", async (req, res) => {
    try {
        const booking = await PackageBooking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }
        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});
// Review Schema
const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  createdAt: { type: Date, default: Date.now },
});

const Review = mongoose.model("Review", reviewSchema);

// Handle Form Submission
app.post("/submit-review", async (req, res) => {
  try {
    const { name, email, message, rating } = req.body;

    if (!name || !email || !message || !rating) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newReview = new Review({ name, email, message, rating });
    await newReview.save();

    res.status(201).json({ message: "Review submitted successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Fetch All Reviews
app.get("/reviews", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Handle 404 Errors
app.use((req, res) => {
  res.status(404).json({ error: "❌ Route not found" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
