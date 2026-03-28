# Multi-Account AWS Deployment Guide

This guide provides step-by-step instructions on how to host CivicAlert on AWS using **two separate AWS accounts** as requested:
- **Account 1 (AI Account)**: Dedicated to AWS Bedrock (Claude models).
- **Account 2 (Hosting Account)**: Dedicated to infrastructure (S3, CloudFront, EC2, SNS, DynamoDB, Location Service, Transcribe).

> [!WARNING]
> By default, the backend uses `AWS_ACCESS_KEY_ID` globally. If you set this in your backend `.env` file, **all** AWS services will try to use the Bedrock account credentials and fail. We will need to make a small code change to strictly separate the credentials.

---

## Part 1: Pre-requisites (Code Change)

Before deploying, update [backend/services/bedrock.py](file:///home/vidit68/Desktop/Hackathon/aws/AWS_techkriti26/backend/services/bedrock.py) to use Bedrock-specific environment variables. This prevents AWS Boto3 from confusing Account 1 (Bedrock) keys with Account 2 (Hosting) services.

1. Open [backend/services/bedrock.py](file:///home/vidit68/Desktop/Hackathon/aws/AWS_techkriti26/backend/services/bedrock.py).
2. Locate the [_analyze_with_bedrock](file:///home/vidit68/Desktop/Hackathon/aws/AWS_techkriti26/backend/services/bedrock.py#86-162) function.
3. Change the client initialization to:

```python
    client = boto3.client(
        "bedrock-runtime",
        region_name=os.getenv("AWS_REGION", "ap-south-1"),
        aws_access_key_id=os.getenv("BEDROCK_AWS_ACCESS_KEY_ID"), # <-- Changed
        aws_secret_access_key=os.getenv("BEDROCK_AWS_SECRET_ACCESS_KEY"), # <-- Changed
    )
```

---

## Part 2: Setup Account 1 (Bedrock Account)

This account will strictly handle AI inference. 

### 1. Enable Model Access
1. Log in to **Account 1** AWS Console.
2. Go to **Amazon Bedrock** -> **Model access** (bottom left menu).
3. Click **Modify model access** and enable **Anthropic Claude 3 Sonnet** and **Claude 3.5 Sonnet** (or Claude Sonnet 4 if available).
4. Save and wait for the access status to show as "Access granted".

### 2. Create IAM User for Backend Access
1. Go to **IAM** -> **Users** -> **Create user**.
2. Name it `civicalert-bedrock-svc`.
3. In Permissions, select **Attach policies directly**.
4. Search for and select **AmazonBedrockFullAccess** (or create a custom policy restricted to `bedrock:InvokeModel`).
5. Complete user creation.
6. Open the newly created user, go to the **Security credentials** tab.
7. Click **Create access key** (Select "Application running outside AWS").
8. **Save the Access Key ID and Secret Access Key**. You will need these for the backend `.env` file later.

---

## Part 3: Setup Account 2 (Hosting Account)

This account handles all the infrastructure components (represented by the `terraform` directory).

### 1. Prepare Terraform environment
1. Ensure you have the [AWS CLI](https://aws.amazon.com/cli/) and [Terraform](https://developer.hashicorp.com/terraform/downloads) installed locally.
2. Configure your local AWS CLI with **Account 2** credentials:
   ```bash
   aws configure
   ```
   *(Enter Account 2 Access Keys down with Admin permissions)*

### 2. Deploy Infrastructure via Terraform
1. Open a terminal and navigate to the `terraform` folder:
   ```bash
   cd terraform
   ```
2. Initialize Terraform:
   ```bash
   terraform init
   ```
3. Copy the variables example file:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```
   *Edit [terraform.tfvars](file:///home/vidit68/Desktop/Hackathon/aws/AWS_techkriti26/terraform/terraform.tfvars) if you want to override default settings (like domain names or region).*
4. Plan the deployment to verify what will be created:
   ```bash
   terraform plan
   ```
5. Apply the infrastructure:
   ```bash
   terraform apply -auto-approve
   ```
6. Once completed, Terraform will output multiple values, including `ec2_public_ip`, `cloudfront_domain`, and `s3_bucket_name`. **Save these!**

> [!NOTE]
> The Terraform code includes an [iam.tf](file:///home/vidit68/Desktop/Hackathon/aws/AWS_techkriti26/terraform/iam.tf) file that provisions an EC2 Instance Profile with permissions for DynamoDB, SNS, Location Service, and Transcribe. The EC2 instance will automatically authenticate to Account 2 without needing hardcoded keys!

---

## Part 4: Backend Configuration & Deployment

Now that the infrastructure in Account 2 is running, you need to configure the backend running on the newly created EC2 instance.

1. SSH into the EC2 instance created by Terraform in Account 2:
   ```bash
   ssh -i <your-ec2-key.pem> ubuntu@<ec2_public_ip>
   ```
   *(Note: Adjust the SSH user and key depending on how the EC2 instance was configured in your Terraform setup).*

2. Navigate to the backend directory and set up the `.env` file:
   ```bash
   cd /home/ubuntu/app/backend  # (Adjust path based on your user_data.sh setup)
   nano .env
   ```

3. Configure the `.env` file with the **Account 1 Bedrock Keys**:
   ```bash
   # AI Provider
   USE_MOCK=false
   USE_ANTHROPIC_API=false
   BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
   
   # Account 1 Credentials (for Bedrock ONLY)
   BEDROCK_AWS_ACCESS_KEY_ID=AKIA_ACCOUNT_1_KEY
   BEDROCK_AWS_SECRET_ACCESS_KEY=SECRET_ACCOUNT_1_KEY
   
   # Account 2 configurations (leave normal AWS keys empty to use Instance Profile!)
   AWS_REGION=ap-south-1
   # DO NOT set AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY here!
   ```

4. Restart the backend service to apply the environment changes.

---

## Part 5: Frontend Configuration & Deployment

The frontend needs to be built and uploaded to the S3 bucket created in Account 2.

1. On your local machine, open [AWS_techkriti26/package.json](file:///home/vidit68/Desktop/Hackathon/aws/AWS_techkriti26/package.json) and adjust any scripts or environment files (like `.env.local` or `.env.production`) to point the `NEXT_PUBLIC_API_URL` to your Account 2 `ec2_public_ip` or API domain.
   
2. Build the Next.js application:
   ```bash
   cd AWS_techkriti26
   npm run build
   ```
   *(Ensure configuring [next.config.ts](file:///home/vidit68/Desktop/Hackathon/aws/AWS_techkriti26/next.config.ts) for static export if you are deploying strictly to S3 as a Static Website)*

3. Sync the `out/` or `public/` build directory to your Account 2 S3 bucket using the AWS CLI:
   ```bash
   aws s3 sync ./out s3://<your-s3-bucket-from-terraform-output> --delete
   ```

4. Invalidate the CloudFront cache in Account 2 to serve the new files:
   ```bash
   aws cloudfront create-invalidation --distribution-id <your-cloudfront-id-from-terraform> --paths "/*"
   ```

## Final Verification
1. Access the CloudFront URL (output by Terraform) in your browser.
2. Submit a voice/text report on the `/report` page.
3. The Backend (Account 2) will receive it, call Bedrock (Account 1) using the explicitly provided `BEDROCK_...` keys, and dispatch alerts via SNS (Account 2) using the EC2 instance profile role.
