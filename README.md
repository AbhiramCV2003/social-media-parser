# Parser for Social Media Feeds

## Overview

Parser for Social Media Feeds is a digital forensics web application designed to automate the collection, parsing, documentation, and management of social media evidence. The system helps investigators collect contextual information from social media platforms and generate standardized PDF reports for forensic analysis.

The project combines a React-based web application, a browser extension, and a Node.js backend to provide an end-to-end workflow for evidence collection and documentation.

---

## Problem Statement

Social media platforms contain valuable digital evidence for investigations. Traditional evidence collection methods are often:

- Time-consuming
- Manual and repetitive
- Error-prone
- Difficult to standardize
- Challenging to manage at scale

This project automates the evidence collection process and generates structured forensic reports.

---

## Objectives

- Automate social media evidence collection.
- Generate standardized PDF reports.
- Capture both textual and visual evidence.
- Provide secure user authentication and report access.
- Improve efficiency and consistency in digital investigations.
- Create a scalable and cost-effective forensic solution.

---

## Features

### User Authentication
- User Registration
- Secure Login
- JWT Authentication
- Password Hashing using bcrypt

### Social Media Data Collection
- Browser Extension based data capture
- Profile information extraction
- Post content extraction
- Timestamp collection
- URL and metadata extraction

### Supported Platforms
- Twitter/X
- Facebook
- Instagram

### Report Generation
- Automated PDF generation
- Embedded screenshots
- Structured evidence documentation
- Searchable reports

### Report Management
- Report status tracking
- Download completed reports
- Secure access control

### Cloud Storage
- Google Cloud Storage integration
- Secure report storage
- Signed URL based downloads

---

## System Architecture

The system consists of three major components:

### Frontend
- React
- Vite
- Axios
- React Router

### Browser Extension
- Manifest V3
- WebExtension APIs
- JavaScript

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- BullMQ
- Redis
- PDFKit
- Google Cloud Storage

---

## Technology Stack

| Category | Technologies |
|-----------|--------------|
| Frontend | React, Vite, Axios |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcrypt |
| Queue System | BullMQ, Redis |
| Report Generation | PDFKit |
| Cloud Storage | Google Cloud Storage |
| Browser Extension | WebExtension APIs, JavaScript |

---

## Workflow

1. Investigator logs into the web application.
2. Browser extension captures social media data.
3. Captured data is sent to the backend.
4. BullMQ queues the report generation process.
5. The backend generates a forensic PDF report.
6. PDF is uploaded to Google Cloud Storage.
7. Investigator downloads the report securely using signed URLs.

---

## Key Benefits

- Faster evidence collection
- Improved accuracy
- Standardized reporting
- Secure data management
- Scalable architecture
- Cost-effective implementation

---

## Future Enhancements

- Support for additional social media platforms
- AI-based content analysis
- Sentiment analysis
- Automated entity extraction
- Advanced search and filtering
- Real-time monitoring capabilities

---

## Project Team

Group No: 11

- Abhiram C V – Project Leader
- Vivek K – Documentation Lead
- Punith V – Developer
- Hrishikesh Naik – Developer

Guide:
Prof. G C Satish

---

## Academic Project

Bachelor of Technology (B.Tech)
Computer Science and Engineering
REVA University
Academic Year: 2024–2025
