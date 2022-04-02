import { ChildProcess, exec, spawn } from 'child_process';
import { io } from 'socket.io-client';
import dotenv from 'dotenv';
dotenv.config();

const tasks = {
  stepper: `cd ~/Code
yarn start`,
  cardboardCNCTest: `cd ~/Code
yarn start`,
};

const currentTasks: { [v: string]: ChildProcess } = {};

const socket = io(process.env.SOCKET_URL as string);

const terminal = spawn('bash');
terminal.stdout.on('data', async (raw: Buffer) => {
  const data = raw.toString().slice(0, -1);
  socket.emit('output', data);
});
terminal.stderr.on('data', async (raw: Buffer) => {
  const data = raw.toString().slice(0, -1);
  socket.emit('err', data);
});
terminal.stdin.write('cd ~\n');

socket.on('connect', () => {
  socket.emit('init', {
    secret: process.env.SECRET,
    mode: 'pi',
  });
});

socket.on('command', (command) => terminal.stdin.write(command));
socket.on('task', ({ name, kill, args }) => {
  if (kill) {
    currentTasks[kill].kill();
    delete currentTasks[kill];
  }
  currentTasks[name] = exec(`"${name}" ${args.join(' ')}`);
});
socket.on('kill', process.exit);
