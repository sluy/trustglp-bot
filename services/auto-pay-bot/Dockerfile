FROM ubuntu:22.04

# Evitar prompts interactivos durante la instalación de paquetes
ENV DEBIAN_FRONTEND=noninteractive

# Instalar Python 3.10 y pip
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Asegurar que 'python' ejecute python3
RUN ln -s /usr/bin/python3.10 /usr/local/bin/python || true

WORKDIR /app

# Copiar requerimientos e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright funcionará perfecto en Ubuntu 22.04 (Jammy)
RUN playwright install-deps chromium
RUN playwright install chromium

# Copiar el codigo principal
COPY . .

# Exponer el puerto
EXPOSE 8000

# Ejecutar con output unbuffered para ver logs en vivo en Easypanel
CMD ["python", "-m", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
