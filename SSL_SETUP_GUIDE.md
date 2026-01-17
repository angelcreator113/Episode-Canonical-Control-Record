# SSL/HTTPS Setup Guide for primepisodes.com

## Step 1: Request SSL Certificate

1. Go to AWS Certificate Manager (ACM):
   https://console.aws.amazon.com/acm/home?region=us-east-1

2. Click **"Request certificate"**

3. Select **"Request a public certificate"** → Click **Next**

4. Add domain names:
   - `primepisodes.com`
   - `*.primepisodes.com`

5. Validation method: Select **DNS validation**

6. Click **Request**

## Step 2: Validate Certificate

1. Click on the certificate you just created

2. You'll see DNS validation records (CNAME records) - copy them

3. Go to Route 53:
   https://console.aws.amazon.com/route53/v2/hostedzones

4. Click on **primepisodes.com** hosted zone

5. Click **Create record** and add each validation CNAME record

6. Wait 5-30 minutes for validation to complete
   - The certificate status will change from "Pending validation" to "Issued"

## Step 3: Add HTTPS Listener to Load Balancer

1. Go to EC2 Load Balancers:
   https://console.aws.amazon.com/ec2/home?region=us-east-1#LoadBalancers:

2. Click on **primepisodes-alb**

3. Go to the **Listeners** tab

4. Click **Add listener**

5. Configure:
   - **Protocol**: HTTPS
   - **Port**: 443
   - **Default SSL/TLS certificate**: Select the certificate you just created
   - **Default action**: Forward to **primepisodes-backend** target group

6. Click **Add**

## Step 4: Update Security Group (if needed)

1. Click on your load balancer → **Security** tab

2. Click on the security group

3. Make sure **Inbound rules** include:
   - Port 80 (HTTP) from 0.0.0.0/0
   - Port 443 (HTTPS) from 0.0.0.0/0

## Step 5: Test

After DNS propagation (5-10 minutes), test:
- https://primepisodes.com
- https://www.primepisodes.com
- https://dev.primepisodes.com
- https://api.primepisodes.com

## Optional: Redirect HTTP to HTTPS

1. Go back to your load balancer listeners

2. Edit the HTTP:80 listener

3. Change default action to **Redirect to**:
   - Protocol: HTTPS
   - Port: 443
   - Status code: 301 (Permanently moved)

4. Save

Now all HTTP traffic will automatically redirect to HTTPS!

---

**Your Load Balancer:**
primepisodes-alb-1912818060.us-east-1.elb.amazonaws.com

**Certificate covers:**
- primepisodes.com
- *.primepisodes.com (including www, dev, api, etc.)
