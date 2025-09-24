import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
const transporter = nodemailer.createTransporter({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.log('Email transporter error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Email templates
const emailTemplates = {
  providerApproval: (providerName) => ({
    subject: 'Your Provider Account Has Been Approved!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Account Approved!</h2>
        <p>Dear ${providerName},</p>
        <p>We are pleased to inform you that your provider account has been approved by our admin team.</p>
        <p>You can now log in to your account and start accepting service requests from clients.</p>
        <p>If you have any questions, please contact our support team.</p>
        <br>
        <p>Best regards,<br>Service Hiring Platform Team</p>
      </div>
    `,
    text: `Dear ${providerName}, Your provider account has been approved. You can now log in and start accepting service requests.`
  }),

  jobAssigned: (providerName, jobDetails) => ({
    subject: 'New Job Assigned to You',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2196F3;">New Job Assignment</h2>
        <p>Dear ${providerName},</p>
        <p>A new job has been assigned to you:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
          <p><strong>Service Type:</strong> ${jobDetails.serviceType}</p>
          <p><strong>Location:</strong> ${jobDetails.location}</p>
          <p><strong>Description:</strong> ${jobDetails.description}</p>
          <p><strong>Priority:</strong> ${jobDetails.priority}</p>
        </div>
        <p>Please log in to your account to view full details and contact the client.</p>
        <br>
        <p>Best regards,<br>Service Hiring Platform Team</p>
      </div>
    `,
    text: `New job assigned: ${jobDetails.serviceType} at ${jobDetails.location}. Description: ${jobDetails.description}`
  }),

  jobStatusUpdate: (clientName, jobDetails, status) => ({
    subject: `Job Status Updated: ${status}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF9800;">Job Status Update</h2>
        <p>Dear ${clientName},</p>
        <p>The status of your job request has been updated to: <strong>${status}</strong></p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
          <p><strong>Service Type:</strong> ${jobDetails.serviceType}</p>
          <p><strong>Location:</strong> ${jobDetails.location}</p>
          <p><strong>Assigned Provider:</strong> ${jobDetails.providerName || 'Pending assignment'}</p>
        </div>
        <p>You can log in to your account to view the current status and contact details.</p>
        <br>
        <p>Best regards,<br>Service Hiring Platform Team</p>
      </div>
    `,
    text: `Your job status updated to ${status}. Service: ${jobDetails.serviceType}, Location: ${jobDetails.location}`
  })
};

// Main email sending function
export const sendEmail = async (to, subject, text, html = null) => {
  try {
    const mailOptions = {
      from: `"Service Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', to);
    return result;
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

// Specific email functions
export const sendProviderApprovalEmail = async (providerEmail, providerName) => {
  const template = emailTemplates.providerApproval(providerName);
  return await sendEmail(providerEmail, template.subject, template.text, template.html);
};

export const sendJobAssignedEmail = async (providerEmail, providerName, jobDetails) => {
  const template = emailTemplates.jobAssigned(providerName, jobDetails);
  return await sendEmail(providerEmail, template.subject, template.text, template.html);
};

export const sendJobStatusUpdateEmail = async (clientEmail, clientName, jobDetails, status) => {
  const template = emailTemplates.jobStatusUpdate(clientName, jobDetails, status);
  return await sendEmail(clientEmail, template.subject, template.text, template.html);
};

export const sendWelcomeEmail = async (email, name, role) => {
  const subject = `Welcome to Service Hiring Platform!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4CAF50;">Welcome to Our Platform!</h2>
      <p>Dear ${name},</p>
      <p>Thank you for registering as a ${role} on our Service Hiring Platform.</p>
      ${role === 'provider' ? 
        '<p>Your account is pending approval. You will receive an email once it is approved.</p>' : 
        '<p>You can now start requesting services from our qualified providers.</p>'
      }
      <p>If you have any questions, feel free to contact our support team.</p>
      <br>
      <p>Best regards,<br>Service Hiring Platform Team</p>
    </div>
  `;
  
  return await sendEmail(email, subject, `Welcome ${name}! Thank you for registering as a ${role}.`, html);
};
