import { ChildProcess, spawn } from 'child_process';
import { kill } from 'process';
import { io } from 'socket.io-client';
import dotenv from 'dotenv';
const oldEnv = { ...process.env };
dotenv.config({
  path: __dirname + '/.env',
});

const tasks: { [v: string]: { cwd: string; program: string; args: string[] } } =
  {
    stepper: {
      cwd: '/home/pi/Code/robotics-pi',
      program: 'yarn',
      args: ['start', 'config=stepper'],
    },
    cardboardCNCTest: {
      cwd: '/home/pi/Code/robotics-pi',
      program: 'yarn',
      args: ['start', 'config=cardboardCNCTest'],
    },
  };

const currentTasks: { [v: string]: ChildProcess } = {};

const socket = io(process.env.SOCKET_URL as string);

const killProcess = (v: ChildProcess) => kill(-(v.pid as number));

const handleExit = () => {
  Object.values(currentTasks).forEach(killProcess);
  process.exit();
};

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
    killProcess(currentTasks[kill]);
    delete currentTasks[kill];
  }
  const task = tasks[name as string];
  currentTasks[name] = spawn(task.program, [...task.args, ...args], {
    env: oldEnv,
    cwd: task.cwd,
    detached: true,
  });
});
socket.on('killTask', (name) => {
  killProcess(currentTasks[name]);
  delete currentTasks[name];
});
socket.on('kill', handleExit);
process.on('SIGINT', handleExit);
