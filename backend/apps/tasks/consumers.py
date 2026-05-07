import json
from channels.generic.websocket import AsyncWebsocketConsumer

class TaskBoardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print("=== [WS] БРАУЗЕР ПОДКЛЮЧИЛСЯ К ВЕБСОКЕТУ! ===")
        self.group_name = 'kanban_board'
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        print(f"=== [WS] БРАУЗЕР ОТКЛЮЧИЛСЯ (КОД: {close_code}) ===")
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def task_update(self, event):
        message = event['message']
        print(f"=== [WS] ОТПРАВЛЯЮ В БРАУЗЕР: {message} ===")
        await self.send(text_data=json.dumps({
            'type': 'task_update',
            'message': message
        }))