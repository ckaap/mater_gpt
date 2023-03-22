## Инструкции для запуска контейнера на машине с Ubuntu 22.04:  

# Установите Docker на целевой машине. Выполните следующие команды для установки Docker:  

sudo apt update  
sudo apt install apt-transport-https ca-certificates curl software-properties-common  
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg  
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null  
sudo apt update  
sudo apt install docker-ce  

# Склонируйте ваш репозиторий с проектом на целевой машине, используя git clone. Например:  
 
git clone https://github.com/your_username/your_project.git  

# Перейдите в каталог проекта:  
 
cd your_project  

# Соберите Docker-образ, используя Dockerfile, находящийся в каталоге проекта:  
 
sudo docker build -t your_image_name .  

# Запустите контейнер из созданного образа:  

sudo docker run --rm -it your_image_name  
## Всё готово! Ваш контейнер должен быть запущен на новой машине, и бот должен работать. Убедитесь, что вы указали правильные токены API и другие настройки в коде или файле .env.  
  
  ###  
  
 sudo docker build -t chatgpt-master .  
 run -d --name chatgpt-master --restart always -e OPENAI_KEY="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" -e  TELEGRAM_KEY="6156548654:AAHjQvGAv6Ga_u4VWkBmp4KvZT2LG9nS9YY" chatgpt-master  
