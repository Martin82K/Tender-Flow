import sys
from PIL import Image, ImageFilter, ImageOps

def remove_background_advanced(input_path, output_path, sensitivity=0.4):
    try:
        img = Image.open(input_path).convert("RGBA")
        width, height = img.size
        
        # BG is approximately [15, 23, 37]
        BG_R, BG_G, BG_B = 15, 23, 37
        
        pixels = img.load()
        newData = []
        
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                
                # Brightness
                brightness = (r + g + b) / 3
                
                # Distance to background color
                dist = ((r - BG_R)**2 + (g - BG_G)**2 + (b - BG_B)**2)**0.5
                
                # Chroma check: Gold/Orange has R > B and G > B
                is_gold = (r > b + 15) and (g > b - 5)
                
                # Main decision logic
                if dist < (60 * sensitivity) and brightness < 80:
                    # Clear background
                    newData.append((0, 0, 0, 0))
                elif not is_gold and brightness < 100:
                    # Likely a dark edge or background shadow
                    alpha = int(max(0, min(255, (dist / (120 * sensitivity)) * 255)))
                    # Fade out dark pixels that aren't gold
                    alpha = int(alpha * (brightness / 255))
                    newData.append((r, g, b, alpha))
                else:
                    # Logo part
                    newData.append((r, g, b, 255))

        img.putdata(newData)
        
        # Refine Alpha Channel
        alpha = img.getchannel('A')
        # Median filter to remove specks
        alpha = alpha.filter(ImageFilter.MedianFilter(3))
        # MaxFilter (Dilation) to heal gaps
        alpha = alpha.filter(ImageFilter.MaxFilter(3))
        
        # Alpha Clipping: Push low-alpha pixels to 0 and high-alpha to 255
        # This eliminates the "halo" of semi-transparent dark pixels
        lookup = []
        for i in range(256):
            if i < 150: # More aggressive clipping of semi-transparent pixels
                lookup.append(0)
            else:
                lookup.append(min(255, int(i * 1.2))) # Boost high alpha
        alpha = alpha.point(lookup)
        
        # Gaussian blur for subtle anti-aliasing
        alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.5))
        
        img.putalpha(alpha)
        
        # Final Edge Clean: Remove any pixel at the edge that isn't gold
        # (Already handled by decision logic, but this is a final pass)
        
        # Crop to contents
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        img.save(output_path, "PNG")
        print(f"Successfully saved pristine logo to {output_path}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python remove_bg_advanced.py <input> <output> [sensitivity]")
    else:
        in_path = sys.argv[1]
        out_path = sys.argv[2]
        sens = float(sys.argv[3]) if len(sys.argv) > 3 else 0.4
        remove_background_advanced(in_path, out_path, sens)
