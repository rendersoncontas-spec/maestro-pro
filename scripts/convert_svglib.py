from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM
import os

def convert(size):
    input_path = f"icons/icon-{size}.svg"
    output_path = f"icons/icon-{size}.png"
    
    if not os.path.exists(input_path):
        print(f"Not found: {input_path}")
        return False
        
    try:
        drawing = svg2rlg(input_path)
        
        # Scale to required dimensions
        scale_x = size / float(drawing.width)
        scale_y = size / float(drawing.height)
        
        drawing.width = size
        drawing.height = size
        drawing.scale(scale_x, scale_y)
        
        renderPM.drawToFile(drawing, output_path, fmt="PNG", dpi=72)
        print(f"Success: {output_path}")
        return True
    except Exception as e:
        print(f"Failed to convert {input_path}: {e}")
        return False

def main():
    print("Starting pure Python SVG to PNG conversion...")
    success1 = convert(192)
    success2 = convert(512)
    
    if success1 and success2:
        try:
            os.remove("icons/icon-192.svg")
            os.remove("icons/icon-512.svg")
            print("Successfully deleted old SVGs.")
        except Exception as e:
            print(f"Could not delete old SVGs: {e}")
    else:
        print("Conversion incomplete, keeping old SVGs.")

if __name__ == "__main__":
    main()
