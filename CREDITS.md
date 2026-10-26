# Сторонние ассеты

| Ассет                                                    | Где используется              | Источник                                                                                      | Лицензия                  |
| -------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| Шрифт Nunito (Vernon Adams и др.)                        | весь интерфейс                | [Google Fonts](https://fonts.google.com/specimen/Nunito), пакет `@fontsource-variable/nunito` | SIL Open Font License 1.1 |
| Иконки Lucide                                            | весь интерфейс                | [lucide.dev](https://lucide.dev), пакет `lucide-react`                                        | ISC                       |
| Иллюстрированные аватары, стиль Notionists (автор Zoish) | аватары сотрудников           | [DiceBear](https://www.dicebear.com/styles/notionists/), пакет `@dicebear/styles`             | CC0 1.0                   |
| Библиотека DiceBear                                      | генерация аватаров на сервере | пакет `@dicebear/core`                                                                        | MIT                       |

Фирменный знак и линейные иллюстрации (`packages/ui/src/illustrations`) нарисованы для проекта
в коде (SVG) и распространяются вместе с ним. Словесный знак Slotwise
(`packages/ui/src/components/brand/artwork.ts`) — контуры букв шрифта Nunito (начертание 800),
OFL разрешает такое использование в логотипе; точка над i — фирменная. Иконки приложений,
картинки для соцсетей и картинки бота (`docs/brand`) собраны из этих знаков (`pnpm brand:assets`). Фотографии в продукте не используются.
Экраны и ролики сайта продукта (`apps/landing/public/media`) и фильм (`docs/case/video`)
сняты с самих приложений на вымышленных демо-данных (`pnpm media:landing`, `pnpm media:film`).
