const bgCtx = document.getElementById("canvas").getContext('2d');
const ctx = document.getElementById("overlay").getContext('2d');
const prCtx = document.getElementById("projection").getContext("2d");


bgCtx.beginPath();
bgCtx.fillStyle = 'black';
bgCtx.rect(150, 125, 10, 225);
bgCtx.rect(200, 150, 10, 25);
bgCtx.rect(200, 200, 10, 25);
bgCtx.rect(200, 250, 10, 25);
bgCtx.rect(250, 125, 10, 225);
bgCtx.rect(150, 340, 100, 10);
bgCtx.fill();

const fov = Math.PI * 70 / 180;
const traceSteps = 150;
const length = 300;
const size = 400;

function trace(originX, originY, originAngle) {
    ctx.strokeStyle = 'pink';
    ctx.fillStyle = 'red';

    ctx.beginPath();
    ctx.fillStyle = 'red';
    ctx.rect(originX - 5, originY - 5, 10, 10);
    ctx.fill();

    const intersections = [];
    const step = fov / traceSteps;

    const radOrigAngle = (Math.PI * originAngle / 180)
    const endAngle = radOrigAngle + fov / 2
    let angle = radOrigAngle - fov / 2;
    for (let i = 0; angle < endAngle; ++i, angle += step) {
        const vec = [Math.cos(angle), Math.sin(angle)];

        let x = 0, y = 0;
        for (let j = 1; j < length; ++j) {
            const pixel = bgCtx.getImageData(x, y, 1, 1).data;
            x = originX + vec[0] * j;
            y = originY + vec[1] * j;

            if (pixel[3] === 255) {
                intersections.push([
                    x, y, angle - radOrigAngle,
                    Math.sqrt(Math.pow(x - originX, 2) + Math.pow(y - originY, 2))
                ]);
                break;
            }
        }
    }

    for (const point of intersections) {
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(point[0], point[1]);
        ctx.stroke();
    }

    ctx.strokeStyle = 'blue';
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + length * Math.cos(radOrigAngle - fov / 2), originY + length * Math.sin(radOrigAngle - fov / 2));
    ctx.lineTo(originX + length * Math.cos(radOrigAngle + fov / 2), originY + length * Math.sin(radOrigAngle + fov / 2));
    ctx.closePath();

    ctx.stroke();

    return intersections;
}

function drawProjection(intersections) {
    prCtx.strokeStyle = 'black';

    for (const [, , angle, z] of intersections) {
        const x = size / 2 + size * (angle / fov);

        prCtx.lineWidth = 70 * (1 / z);
        prCtx.beginPath();

        prCtx.moveTo(x, size / 2 * (1 - 20 / z));
        prCtx.lineTo(x, size / 2 * (1 + 20 / z));

        prCtx.stroke();
    }
}

let angle = 90;
let x = 200, y = 25;
let changed = true;

document.onkeypress = (e) => {
    switch (e.key) {
        case "w":
            x += Math.cos(Math.PI * angle / 180) * 5;
            y += Math.sin(Math.PI * angle / 180) * 5;
            changed = true;
            break;
        case "s":
            x -= Math.cos(Math.PI * angle / 180) * 3;
            y -= Math.sin(Math.PI * angle / 180) * 3;
            changed = true;
            break;

        case "a":
            angle -= 5;
            changed = true;
            break;
        case "d":
            angle += 5;
            changed = true;
            break;
    }
}


setInterval(() => {
    if (changed) {
        ctx.clearRect(0, 0, size, size);
        const intersections = trace(~~x, ~~y, angle);

        prCtx.clearRect(0, 0, size, size);
        drawProjection(intersections);

        changed = false;
    }
}, 1000 / 24);