# PTTW API

## Классы

`Message`  
Представляет сообщение в чате.
- `elem: HTMLElement`  
  HTML-элемент, содержащий сообщение.

- `type: string`  
  Тип сообщения. Одно из следующих значений: `normal`, `party`, `whisper`, `system`, `meta-line`.

- `time: string`  
   Время отправки сообщения.

- `author: string`  
  Автор сообщения.

- `text: string`  
  Текст сообщения.

- `async getPlayer(): Player`  
  Получить объект игрока, отправившего сообщение.

`Message.create(text, author, type)`  
Создать сообщение. Параметры `author` и `type` можно опустить, в таком случае сообщение будет системным.

`Player`  
Представляет открытый профиль игрока.
- `elem: HTMLElement`  
  HTML-элемент профиля игрока.

- `name: string`  
  Имя игрока.

- `status: string`  
  Статус игрока. Одно из следующих значений: `online`, `away`, `busy`, `looking`.

- `tags: Array<string>`  
  Список тегов игрока. Теги могут принимать значения `friend`, `party`, `supporter`.

- `social: { name: string, url: string } | null`  
  Привязанная социальная сеть игрока. Если она есть, это свойство - объект со свойствами `name` (ник) и `url` (ссылка на профиль). Если ее нет, равно `null`

- `isOpened(): boolean`  
  Узнать, открыт ли профиль игрока.

- `close(): void`  
  Закрыть профиль игрока.

- `action(name: string): void`  
  Выполнить действие из выпадающего меню (`Give item`, `Add to friends` и т.д.)

- `isActionAvailable(name: string): boolean`  
  Узнать, доступно ли указанное действие.

## Функции

### Управление

`async pt.move(direction: string, time: number): void`  
Двигаться в указанном направлении (`left`, `right`, `up`, `down`) указанное количество миллисекунд.

`pt.action(name: string | number): void`  
Выполнить действие с панели действий по имени или индексу (начиная с 0).

### Статус

Статус может принимать следующие значения: `online`, `away`, `busy`, `looking for chat`, `looking for roleplay`.

`pt.status.get(): string`  
Получить активный статус игрока.

`pt.status.set(status: string): void`  
Установить статус игрока.

### Чат

`pt.chat.getMessage(offset: number): Message`  
Получить объект Message сообщения с номером `offset`, начиная с последнего сообщения.

`pt.chat.getMessageByElement(elt: HTMLElement): Message`  
Получить объект Message из HTML-элемента сообщения.

`pt.chat.getMessages(start: number, end: number): Array<Message>`  
Получить массив объектов Message, содержащих сообщения с номерами `start` по `end`, начиная с последнего отправленного сообщения.

`pt.chat.sendMessage(text: string): void`  
Отправить сообщение с указанным текстом.

`pt.chat.addMessage(msg: Message): Message`  
Добавить в чат (не отправляя) сообщение с параметрами объекта Message. Возвращает переданный объект с установленным параметром `elem`.

`pt.chat.editMessage(msg: Message): void`  
Отредактировать сообщение (только у себя).

`pt.chat.registerCommand(cmd: string, callback: Function): void`  
Добавить обработчик команды `cmd` - каждый раз, когда игрок отправляет эту команду в чат, будет вызываться функция `callback` с переданным ей списком аргументов команды. Параметр `cmd` должен быть без слеша в начале.

#### Логгер чата

`pt.chat.logger.start(): void`  
Запустить логгер.

`pt.chat.logger.stop(): void`  
Остановить логгер.

`pt.chat.logger.text: string`  
Текст, собранный логгером.

#### События чата

`pt.chat.hook.attach(hookType: string, callback: Function): number`  
Добавить прослушиватель событий чата. Возвращает индекс прослушивателя.
| Значение `hookType` | Поведение |
| ------------------- | --------- |
| `send`              | Функция вызывается со строковым аргументом - текстом сообщения. Возвращаемое функцией значение изменяет текст отправляемого сообщения |
| `receive`           | Функция вызывается с аргументом типа `Message` - объектом полученного сообщения. Возвращаемое значение игнорируется |

`pt.chat.hook.detach(index: number): void`  
Удалить прослушиватель событий чата по его индексу.

### Игроки

`pt.player.get(): Player`  
Получить объект Player из открытого профиля игрока.

`async pt.player.getByMessage(msg: Message): Player)`  
Получить объект Player автора указанного сообщения.

### Зум

`pt.zoom.get(): number`  
Получить текущее значение зума.

`pt.zoom.set(val: number): void`
Установить новое значение зума.

### Кнопки меню

`pt.menuButton.add(text: string, callback: Function): number`  
Добавить кнопку с текстом `text` в меню настроек игры. При нажатии на кнопку будет выполнена функция `callback`. Возвращает индекс кнопки.

`pt.menuButton.remove(index: number): void`  
Удалить кнопку из меню настроек игры.

### Графика

`pt.graphics.getGlContext(): WebGL2RenderingContext`  
Контекст WebGL2.

`pt.graphics.readPixel(x: number, y: number): Uint8Array(4)`  
Прочитать пиксель по указанным координатам. Возвращает массив в формате ARGB.

`pt.graphics.readAllPixels(): Uint8Array`  
Прочитать все пиксели.

### Управление PTTW

`pt.tweaker.optionsUI(): void`  
Открыть настройки PTTW.

`pt.tweaker.scriptsUI(): void`  
Открыть меню скриптов PTTW.

`pt.tweaker.addScriptByURL(url: string, callback: Function): void`  
Добавить скрипт по URL. После добавления скрипта будет выполнена функция `callback`.