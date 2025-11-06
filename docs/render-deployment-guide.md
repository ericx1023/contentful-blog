# Deploy Isso to Render.com (Free)

## Step 1: Prepare Repository

Your isso-server directory should have:

```
isso-server/
├── Dockerfile
├── isso.conf
└── README.md
```

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

RUN pip install isso gunicorn

WORKDIR /app
COPY isso.conf /app/

EXPOSE 10000

CMD ["gunicorn", "--bind", "0.0.0.0:10000", "--worker-class", "gevent", "--workers", "1", "isso.run:application"]
```

**isso.conf:**
```ini
[general]
dbpath = /tmp/comments.db
host = 
max-age = 15m
notify = stdout

[server]
listen = http://0.0.0.0:10000/

[markup]
options = strikethrough, superscript, autolink
allowed-elements = 
allowed-attributes = 

[hash]
algorithm = pbkdf2

[moderation]
enabled = false

[admin]
enabled = true
password = your-secure-password-123

[guard]
enabled = true
ratelimit = 2
direct-reply = 3
reply-to-self = false
require-author = false
require-email = false
```

## Step 2: Deploy to Render

1. **Go to [render.com](https://render.com)**
2. **Sign up with GitHub** (free account)
3. **Click "New +"** → **"Web Service"**
4. **Connect your GitHub repository** (isso-server)
5. **Configure the service:**
   - **Name**: `isso-comments`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Runtime**: `Docker`
   - **Instance Type**: `Free`

6. **Advanced settings:**
   - **Docker Command**: Leave empty (uses Dockerfile CMD)
   - **Docker Context Directory**: `isso-server`
   - **Dockerfile Path**: `isso-server/Dockerfile`
   - **Health Check Path**: `/js/embed.min.js` ⚠️ **CRITICAL - Isso has no / endpoint**
   - **Auto-Deploy**: `Yes`

7. **Click "Create Web Service"**

## Step 3: Configure Environment Variables

In Render dashboard → Your service → Environment:

- **Key**: `PORT` **Value**: `10000`

## Step 4: Get Your Isso URL

After deployment (5-10 minutes), you'll get a URL like:
`https://isso-comments-xxx.onrender.com`

## Step 5: Update Configuration

Update your `isso.conf` with your blog domain:

```ini
[general]
host = https://yourdomain.com, https://your-blog.vercel.app
```

Commit and push - Render will auto-redeploy.

## Step 6: Test

```bash
curl https://your-isso-url.onrender.com/info
```

## Step 7: Update Your Blog

In your blog's `.env`:
```
NEXT_PUBLIC_ISSO_URL=https://your-isso-url.onrender.com
```

## Free Tier Limitations

- **Sleep after 15 minutes** of inactivity
- **750 hours/month** total uptime
- **First request after sleep**: ~30 seconds cold start

For a personal blog, this is usually sufficient!

## Troubleshooting

### Service not responding (curl timeout)

**Symptom**: `curl https://isso-server.onrender.com/js/embed.min.js` hangs and times out.

**Most likely cause**: Health check misconfiguration. Render requires services to respond to health checks, but Isso has no endpoint at `/` (the default).

**Solution**:
1. Go to Render Dashboard → Your Service → Settings
2. Scroll to "Health Check Path"
3. Change from `/` to `/js/embed.min.js`
4. Click "Save Changes"
5. Render will redeploy automatically

**Alternative**: Use the `render.yaml` file in the repo root (already configured correctly).

### CORS errors in browser console

**Symptom**: Browser shows CORS errors like "Access-Control-Allow-Origin".

**Solution**: Update `isso.conf` to include your domain:
```ini
[general]
host = 
    http://localhost:3000
    https://www.psychevalley.org
    https://yourdomain.vercel.app
```

Push the changes and Render will auto-deploy.

### Check service health

```bash
# Should return 200 OK after health check is fixed
curl -I https://isso-server.onrender.com/js/embed.min.js

# Check if service is running
curl https://isso-server.onrender.com/info
```