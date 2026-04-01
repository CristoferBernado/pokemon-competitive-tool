from PIL import Image

input_path = r"d:\Projeto\pokemon-api\app\static\img\Logo do Bidoof Lab's com cauda.png"
output_path = r"d:\Projeto\pokemon-api\app\static\img\logo_transparent.png"

def make_transparent(in_file, out_file, threshold=240):
    img = Image.open(in_file).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(out_file, "PNG")
    print(f"Saved {out_file}")

if __name__ == '__main__':
    make_transparent(input_path, output_path)
