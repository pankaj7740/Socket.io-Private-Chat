const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');


require('./dbConnect');
const tokenModel = require('./schema');

const app = express();


const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);


app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors());


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/session', (req, res) => {
  let data = {
    username: req.body.username,
    userID: uuidv4()
  }
  res.send(data);
});

io.use((socket, next) => {
  const username = socket.handshake.auth.username;
  const userID = socket.handshake.auth.userID;
  if(!username) {
    return next(new Error('Invalid username'));
  }
  socket.username = username;
  socket.id = userID;
  next();
});

let users = [];
io.on('connection', async socket => {
  const methods = {
    getToken: (sender, receiver) => {
      let key = [sender, receiver].sort().join("_");
      return key;
    },
    fetchMessages: async (sender, receiver) => {
      let token = methods.getToken(sender, receiver);
      const findToken = await tokenModel.findOne({userToken: token});
      if(findToken) {
        io.to(sender).emit('stored-messages', {messages: findToken.messages});
      } else {
        let data = {
          userToken: token,
          messages: []
        }
        const saveToken = new tokenModel(data);
        const createToken = await saveToken.save();
        if(createToken) {
          console.log('Token created!');
        } else {
          console.log('Error in creating token');
        }
      }
    },
    saveMessages : async ({from, to, message, time}) => {
      let token = methods.getToken(from, to);
      let data = {
        from,
        message,
        time,
        to
      }
      tokenModel.updateOne({userToken: token}, {
        $push: {messages: data}
      }, (err, res) => {
        if (err) throw err;
        console.log('Message saved!', res);
      });
    }
  }


  let userData = {
    username : socket.username,
    userID : socket.id
  }
  users.push(userData);
  io.emit('users', {users});

  socket.on('disconnect', () => {
    users = users.filter( user => user.userID !== socket.id);
    io.emit('users', {users} );
    io.emit('user-away', socket.id);
  });

  socket.on('typing',payload =>{
    console.log(payload.message);
    io.to(payload.to).emit('typing',payload);
  })

  socket.on('message-to-server', payload => {
    io.to(payload.to).emit('message-to-user', payload);
    methods.saveMessages(payload);
  });

  socket.on('fetch-messages', ({receiver}) => {
    methods.fetchMessages(socket.id, receiver);
  });
 

});

server.listen(3000, () => {
  console.log(`Server is running on port 3000...`);
});