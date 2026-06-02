import turtle

screen = turtle.Screen()
screen.setup(800, 800)
screen.bgcolor("white")

t = turtle.Turtle()
t.speed(0)
t.pensize(3)

# --------------------------------------------------
# Calendar outline
# --------------------------------------------------
t.penup()
t.goto(-150, 150)
t.pendown()

for _ in range(2):
    t.forward(300)
    t.right(90)
    t.forward(300)
    t.right(90)

# Header
t.penup()
t.goto(-150, 100)
t.pendown()
t.forward(300)

# Rings
for x in (-80, 80):
    t.penup()
    t.goto(x, 180)
    t.pendown()
    t.circle(10)

# --------------------------------------------------
# Big M
# --------------------------------------------------
t.penup()
t.goto(-120, 20)
t.pendown()

t.goto(-120, -100)
t.goto(-70, -20)
t.goto(-20, -100)
t.goto(-20, 20)

# --------------------------------------------------
# Calendar grid
# --------------------------------------------------
cell = 30
gap = 10
start_x = 40
start_y = 20

for row in range(3):
    for col in range(3):
        x = start_x + col * (cell + gap)
        y = start_y - row * (cell + gap)

        t.penup()
        t.goto(x, y)
        t.pendown()

        if row == 1 and col == 1:
            t.fillcolor("blue")
            t.begin_fill()

        for _ in range(4):
            t.forward(cell)
            t.right(90)

        if row == 1 and col == 1:
            t.end_fill()

# --------------------------------------------------
# Markdown symbol
# --------------------------------------------------
t.penup()
t.goto(-120, -150)
t.pendown()
t.write(
    "#",
    font=("Arial", 32, "bold")
)

# --------------------------------------------------
# Math symbol
# --------------------------------------------------
t.penup()
t.goto(-50, -150)
t.pendown()
t.write(
    "∫",
    font=("Arial", 32, "bold")
)

t.hideturtle()
screen.mainloop()
