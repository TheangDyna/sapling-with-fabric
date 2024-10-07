"use client";

import Canvas from "@/components/Canvas";
import LeftSidebar from "@/components/LeftSidebar";
import Navbar from "@/components/Navbar";
import RightSidebar from "@/components/RightSidebar";
import { defaultNavElement } from "@/constants";
import {
  handleCanvaseMouseMove,
  handleCanvasMouseDown,
  handleCanvasMouseUp,
  handleCanvasObjectModified,
  handleCanvasObjectMoving,
  handleCanvasObjectScaling,
  handleCanvasSelectionCreated,
  handlePathCreated,
  initializeFabric,
} from "@/lib/canvas";
import { handleDelete } from "@/lib/key-events";
import { handleImageUpload } from "@/lib/shapes";
import { ActiveElement, Attributes } from "@/types/type";
import { fabric } from "fabric";
import { useEffect, useRef, useState } from "react";

const Home = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const isDrawing = useRef(false);
  const shapeRef = useRef<fabric.Object | null>(null);
  const selectedShapeRef = useRef<string | null>(null);

  const activeObjectRef = useRef<fabric.Object | null>(null);
  const isEditingRef = useRef(false);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const [suggestionBox, setSuggestionBox] = useState({
    visible: false,
    x: 0,
    y: 0,
    suggestion: "",
  });

  const showSuggestionBox = (x: number, y: number, suggestion: string) => {
    setSuggestionBox({
      visible: true,
      x,
      y,
      suggestion,
    });
  };

  const hideSuggestionBox = () => {
    setSuggestionBox({
      visible: false,
      x: 0,
      y: 0,
      suggestion: "",
    });
  };

  const [activeElement, setActiveElement] = useState<ActiveElement>({
    name: "",
    value: "",
    icon: "",
  });

  const [elementAttributes, setElementAttributes] = useState<Attributes>({
    width: "",
    height: "",
    fontSize: "",
    fontFamily: "",
    fontWeight: "",
    fill: "#aabbcc",
    stroke: "#aabbcc",
  });

  const handleActiveElement = (elem: ActiveElement) => {
    setActiveElement(elem);

    switch (elem?.value) {
      case "reset":
        fabricRef.current?.clear();
        setActiveElement(defaultNavElement);
        break;
      case "delete":
        handleDelete(fabricRef.current as any);
        setActiveElement(defaultNavElement);
        break;
      case "image":
        break;
      case "comments":
        break;
      default:
        selectedShapeRef.current = elem?.value as string;
        break;
    }
  };

  const checkGrammar = async (textElement: fabric.Textbox) => {
    const text = textElement.text || "";

    try {
      const response = await fetch("https://api.sapling.ai/api/v1/edits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "02T1BD34ZL5ID0WUIH6R0NIF42LQDSY7",
          session_id: "your-session-id",
          text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || "Something went wrong");
      }

      const data = await response.json();

      clearGrammarHighlight(textElement, 0, text.length);

      if (data.edits.length > 0) {
        highlightGrammarIssue(
          textElement,
          data.edits.map((issue: any) => ({
            start: issue.start + issue.sentence_start,
            end: issue.end + issue.sentence_start,
            replacement: issue.replacement,
            type: issue.general_error_type,
          }))
        );
      }
    } catch (error) {
      console.error("Error checking grammar:", error);
    }
  };

  const highlightGrammarIssue = (
    textElement: fabric.Textbox,
    issues: {
      start: number;
      end: number;
      replacement: string;
      type: string;
    }[]
  ) => {
    issues.forEach((issue) => {
      for (let i = issue.start; i < issue.end; i++) {
        if (!textElement.styles[0]) {
          textElement.styles[0] = {};
        }

        let style = {};
        switch (issue.type) {
          case "Punctuation":
            style = { underline: true, fill: "orange" };
            break;
          case "Grammar":
            style = { underline: true, fill: "blue" };
            break;
          default:
            style = { underline: true, fill: "red" };
        }

        textElement.styles[0][i] = {
          ...style,
          mouseover: () => {
            console.log("called!!!");

            const transform = textElement.calcTransformMatrix();
            const left = transform[4];
            const top = transform[5];
            showSuggestionBox(left, top, issue.replacement);
          },
        };
      }
    });

    textElement.set("dirty", true);
    textElement.canvas?.renderAll();
  };

  const clearGrammarHighlight = (
    textElement: fabric.Textbox,
    start: number,
    end: number
  ) => {
    for (let i = start; i < end; i++) {
      if (textElement.styles[0] && textElement.styles[0][i]) {
        delete textElement.styles[0][i];
      }
    }

    textElement.set("dirty", true);
    textElement.canvas?.renderAll();
  };

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const canvas = initializeFabric({
      fabricRef,
      canvasRef,
    });

    canvas.on("mouse:down", (options) => {
      handleCanvasMouseDown({
        options,
        canvas,
        selectedShapeRef,
        isDrawing,
        shapeRef,
      });
    });

    canvas.on("mouse:move", (options) => {
      handleCanvaseMouseMove({
        options,
        canvas,
        isDrawing,
        selectedShapeRef,
        shapeRef,
      });
    });

    canvas.on("mouse:up", () => {
      handleCanvasMouseUp({
        canvas,
        isDrawing,
        shapeRef,
        activeObjectRef,
        selectedShapeRef,
        setActiveElement,
      });
    });

    canvas.on("path:created", (options) => {
      handlePathCreated({
        options,
      });
    });

    canvas.on("object:modified", (options) => {
      handleCanvasObjectModified({
        options,
      });
    });

    canvas.on("object:moving", (options) => {
      handleCanvasObjectMoving({
        options,
      });
    });

    canvas.on("selection:created", (options) => {
      handleCanvasSelectionCreated({
        options,
        isEditingRef,
        setElementAttributes,
      });
    });

    canvas.on("object:scaling", (options) => {
      handleCanvasObjectScaling({
        options,
        setElementAttributes,
      });
    });

    canvas.on("text:changed", (event) => {
      const activeText = event.target as fabric.Textbox;
      if (activeText) {
        checkGrammar(activeText);
      }
    });

    return () => {
      canvas.dispose();
    };
  }, [canvasRef]);

  useEffect(() => {
    const canvas = fabricRef.current;

    if (canvas) {
      canvas.on("mouse:move", handleMouseOver);
    }

    return () => {
      if (canvas) {
        canvas.off("mouse:move", handleMouseOver);
      }
    };
  }, []);

  const handleMouseOver = (event) => {
    const canvas = fabricRef.current;
    const pointer = canvas?.getPointer(event.e);

    const objects = canvas?.getObjects();

    objects?.forEach((object) => {
      if (object instanceof fabric.Textbox) {
        const { left, top, width, height } = object.getBoundingRect();
        if (
          pointer &&
          pointer.x > left &&
          pointer.x < left + width &&
          pointer.y > top &&
          pointer.y < top + height
        ) {
          const style = object.styles[0];

          console.log(style);

          if (style) {
            Object.keys(style).forEach((key) => {
              if (style[key]?.mouseover) {
                style[key].mouseover();
              } else {
                hideSuggestionBox();
              }
            });
          }
        } else {
          hideSuggestionBox();
        }
      }
    });
  };

  return (
    <main className="h-screen overflow-hidden">
      <Navbar
        imageInputRef={imageInputRef}
        activeElement={activeElement}
        handleActiveElement={handleActiveElement}
        handleImageUpload={(e: any) => {
          e.stopPropagation();
          handleImageUpload({
            file: e.target.files[0],
            canvas: fabricRef as any,
            shapeRef,
          });
        }}
      />
      <section className="flex h-full">
        <LeftSidebar />

        <Canvas canvasRef={canvasRef} />

        <RightSidebar />
      </section>
      {suggestionBox.visible && (
        <div
          className="absolute bg-white border border-gray-400 p-2 shadow-lg"
          style={{
            top: suggestionBox.y,
            left: suggestionBox.x,
          }}
        >
          <p>{suggestionBox.suggestion}</p>
        </div>
      )}
    </main>
  );
};

export default Home;
