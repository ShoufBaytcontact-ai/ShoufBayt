import nodemailer from "nodemailer";

export const sendLoginCodeEmail = async (email, code) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"SmartEstate Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your SmartEstate Login Code",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>SmartEstate Login Verification</h2>
        <p>Your login verification code is:</p>
        <h1 style="letter-spacing: 4px;">${code}</h1>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  });
};  