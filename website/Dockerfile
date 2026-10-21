# Landing de Mirentia — imagen de produccion.
#
# El sitio es estatico y lo sirve nginx. La unica pieza dinamica es el proxy
# /api/ hacia el backend Go (el form del funnel), y su destino se inyecta por
# variable de entorno: por eso la config es un TEMPLATE que renderiza el
# entrypoint de la imagen oficial de nginx, no un conf.d estatico. Ver
# docker-nginx.conf.template para el detalle de por que `env` no sirve.
FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*
COPY . /usr/share/nginx/html/
COPY docker-nginx.conf.template /etc/nginx/templates/default.conf.template

# Solo se sustituye API_UPSTREAM. Sin este filtro el entrypoint sustituye
# TODAS las variables de entorno y se come el $host / $uri / $scheme de nginx.
ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$

# La config del sitio, no la de infraestructura: estos archivos no se sirven
# por HTTP. `content/` es material de trabajo en markdown, no del sitio.
RUN rm -f /usr/share/nginx/html/Dockerfile \
          /usr/share/nginx/html/docker-compose.yml \
          /usr/share/nginx/html/docker-compose.dev.yml \
          /usr/share/nginx/html/nginx.conf \
          /usr/share/nginx/html/nginx.dev.conf \
          /usr/share/nginx/html/docker-nginx.conf.template \
      && rm -rf /usr/share/nginx/html/content

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
