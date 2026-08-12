FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*
COPY index.html /usr/share/nginx/html/index.html
COPY assets/ /usr/share/nginx/html/assets/
COPY cases/ /usr/share/nginx/html/cases/
COPY okrs/ /usr/share/nginx/html/okrs/
COPY robots.txt /usr/share/nginx/html/robots.txt
COPY sitemap.xml /usr/share/nginx/html/sitemap.xml
COPY og-image.svg /usr/share/nginx/html/og-image.svg
COPY og-image.png /usr/share/nginx/html/og-image.png
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
