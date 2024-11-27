import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import multer from "multer";

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    const uploadPath = path.resolve(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath); // Create uploads directory if it doesn't exist
    }
    cb(null, uploadPath);
  },
  filename: (_, __, cb) => {
    cb(null, "sample.pdf"); // Always save as sample.pdf
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed."));
    }
    cb(null, true);
  },
});

// Endpoint to handle file upload
app.post("/upload-pdf", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  res.send({
    message: "File uploaded successfully.",
    filePath: `/uploads/sample.pdf`, // Path to the uploaded file
  });
});

// API to send email with signing link
app.post("/send-email", async (req, res) => {
  const { email, coordinates } = req.body;

  if (!email || !coordinates) {
    return res.status(400).send("Email and coordinates are required.");
  }

  const documentLink = `http://localhost:3000/sign-document`;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "saurabh.s@theyarnbazaar.com",
        pass: "behi quln suje wvum", // Use your Gmail app password
      },
    });

    const coordinatesText = coordinates
      .map((coord, index) => `Area ${index + 1}: X=${coord.x}, Y=${coord.y}`)
      .join("<br>");

    const mailOptions = {
      from: "saurabh.s@theyarnbazaar.com",
      to: email,
      subject: "Document Signing Request",
      html: `<p>Hello,</p>
             <p>You have a document to sign. The signing areas are as follows:</p>
             <p>${coordinatesText}</p>
             <p>Click <a href="${documentLink}">here</a> to access the document and sign it.</p>`,
    };

    await transporter.sendMail(mailOptions);

    console.log(`Email sent to ${email}`);
    res.send("Email sent successfully.");
  } catch (error) {
    console.error("Error sending email:", error.message);
    res.status(500).send("Failed to send email.");
  }
});

// API to save the signed document
app.post("/save-signed-pdf", async (req, res) => {
  const { signature, coordinates } = req.body;

  if (!signature || !coordinates) {
    return res.status(400).send("Signature and coordinates are required.");
  }

  const samplePdfPath = path.resolve(__dirname, "uploads", "sample.pdf");
  if (!fs.existsSync(samplePdfPath)) {
    return res.status(404).send("Original PDF not found. Please upload a file first.");
  }

  try {
    const pdfBytes = fs.readFileSync(samplePdfPath); // Load the original PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0]; // Assume signatures are on the first page

    // Decode the Base64 signature to an image
    const signatureBytes = Buffer.from(signature.split(",")[1], "base64");
    const signatureImage = await pdfDoc.embedPng(signatureBytes);

    const { width, height } = signatureImage.scale(0.5); // Scale down signature

    // Add the signature to each coordinate
    coordinates.forEach(({ x, y }) => {
      firstPage.drawImage(signatureImage, {
        x,
        y: firstPage.getHeight() - y - height,
        width,
        height,
      });
    });

    // Save the signed PDF to a file
    const signedPdfBytes = await pdfDoc.save();
    const signedPdfPath = path.resolve(__dirname, "uploads", "signed_document.pdf");
    fs.writeFileSync(signedPdfPath, signedPdfBytes);

    res.send({
      message: "Signed document saved successfully.",
      filePath: `/uploads/signed_document.pdf`, // Path to the signed document
    });
  } catch (error) {
    console.error("Error saving signed PDF:", error.message);
    res.status(500).send("Failed to save signed document.");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
