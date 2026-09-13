# 📥 How to Download ACM Certificate Files

**Current Status:** Certificate files not found in Downloads  
**Next:** Download from AWS Console

---

## 🎯 Step-by-Step: Download Certificate Files

### Step 1: Open AWS Console
1. Go to: https://console.aws.amazon.com
2. Login to your AWS account
3. Search for: "Certificate Manager" (or go to Services → Security → Certificate Manager)

### Step 2: Find Your Certificate
1. Click on **"Certificates"** in the left menu
2. Look for **"primepisodes.com"** in the list
3. Click on it to open the certificate details

### Step 3: Download Certificate
In the certificate details page, look for a **"Download"** button or section:

**You need 3 files:**

#### File 1: Certificate (PEM)
- Label: "Certificate" or "Certificate body"
- Format: PEM
- **Right-click** → "Save link as..."
- Save as: **primepisodes.crt**
- Location: C:\Users\12483\Downloads\

#### File 2: Private Key (PEM)
- Label: "Private key" or "Private key body"
- Format: PEM
- **Right-click** → "Save link as..."
- Save as: **primepisodes.key**
- Location: C:\Users\12483\Downloads\

#### File 3: Certificate Chain (PEM)
- Label: "Certificate chain" or "Intermediate chain"
- Format: PEM
- **Right-click** → "Save link as..."
- Save as: **certificate-chain.pem**
- Location: C:\Users\12483\Downloads\

### Step 4: Verify Files Downloaded

Open PowerShell and run:

```powershell
$files = @(
    "C:\Users\12483\Downloads\primepisodes.crt",
    "C:\Users\12483\Downloads\primepisodes.key",
    "C:\Users\12483\Downloads\certificate-chain.pem"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Host "✅ $file ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
    }
}
```

---

## 📸 AWS Console Screenshot Guide

If you can't find the download section:

1. **Certificate Details Page** shows:
   - Domain names (primepisodes.com, www.primepisodes.com)
   - Status: **Issued** ✅
   - Expiration date

2. **Look for:**
   - A section labeled "Certificate details" or "Certificate content"
   - Download buttons or expandable sections
   - Usually has tabs: "Details", "Content", "Download", etc.

3. **Alternative:**
   - Some AWS versions show the certificate content in text boxes
   - Copy/paste the content into text files manually
   - Save with proper extensions (.crt, .key, .pem)

---

## 🔑 Manual Copy-Paste Method (If Download Doesn't Work)

If you can't download directly:

### For Certificate (primepisodes.crt):
1. In AWS Console, find the certificate content that starts with: `-----BEGIN CERTIFICATE-----`
2. Copy everything until: `-----END CERTIFICATE-----` (include both lines)
3. Open Notepad
4. Paste the content
5. Save as: `primepisodes.crt` in Downloads folder

### For Private Key (primepisodes.key):
1. Find the private key content starting with: `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN PRIVATE KEY-----`
2. Copy everything until: `-----END RSA PRIVATE KEY-----` or `-----END PRIVATE KEY-----`
3. Open Notepad
4. Paste the content
5. Save as: `primepisodes.key` in Downloads folder

### For Certificate Chain (certificate-chain.pem):
1. Find the chain content
2. Usually shows multiple `-----BEGIN CERTIFICATE-----` blocks
3. Copy all of them
4. Open Notepad
5. Paste the content
6. Save as: `certificate-chain.pem` in Downloads folder

---

## ⚠️ Important Notes

- **Private Key (.key file):** Keep this PRIVATE! Do not share or commit to git
- **Format:** Must be PEM format (text-based, not binary)
- **Encoding:** UTF-8 or ASCII
- **Line endings:** LF (Unix) or CRLF (Windows) both work
- **File size:**
  - Certificate should be ~1-2 KB
  - Private key should be ~2-3 KB
  - Certificate chain should be ~2-5 KB

---

## ✅ After Files Are Downloaded

Once you have all 3 files in `C:\Users\12483\Downloads\`, run:

```powershell
cd C:\Users\12483\prime\ studios\BRD\Episode-Canonical-Control-Record
# Then proceed with the upload script
```

---

**Next:** Download the 3 files, then we'll upload them to the server.

