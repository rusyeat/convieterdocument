# Qalam PDF is a static site: nginx serves the files, all processing runs in the browser.
# docker build -t qalam-pdf . && docker run -p 8080:80 qalam-pdf
FROM nginx:1.27-alpine
COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY assets /usr/share/nginx/html/assets
EXPOSE 80
