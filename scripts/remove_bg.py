import sys
from PIL import Image

def remove_background(input_path, output_path, threshold=50):
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()

        # The background is dark, let's look at the corners to get average background color
        width, height = img.size
        corners = [
            img.getpixel((0, 0)),
            img.getpixel((width - 1, 0)),
            img.getpixel((0, height - 1)),
            img.getpixel((width - 1, height - 1))
        ]
        
        # Average color of corners
        avg_bg = [sum(c[i] for c in corners) // 4 for i in range(3)]
        print(f"Detected average background color: {avg_bg}")

        newData = []
        for item in datas:
            # Calculate distance from background color
            dist = sum((item[i] - avg_bg[i]) ** 2 for i in range(3)) ** 0.5
            
            if dist < threshold:
                newData.append((0, 0, 0, 0)) # Fully transparent
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Successfully saved transparent logo to {output_path}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python remove_bg.py <input> <output> [threshold]")
    else:
        in_path = sys.argv[1]
        out_path = sys.argv[2]
        thresh = int(sys.argv[3]) if len(sys.argv) > 3 else 50
        remove_background(in_path, out_path, thresh)
